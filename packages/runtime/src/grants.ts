import { createHash, createHmac } from "node:crypto";
import {
	type ActorReference,
	type AuthoritativePlane,
	type AuthoritySnapshot,
	type CommandFailure,
	type CommandReference,
	type GrantUse,
	type JsonValue,
	type TargetReference,
	targetReferenceSchema,
} from "@86d-app/core/commands";
import { z } from "zod";
import type { CommandPrincipal } from "./command";

export interface ChangeSetReviewContent {
	changeSetHashVersion: number;
	ownerPlane: AuthoritativePlane;
	target: TargetReference;
	proposal: {
		command: CommandReference;
		target: TargetReference;
		inputDigest: string;
		opaqueDraftReference?: string | undefined;
	};
	supersedesChangeSetId?: string | undefined;
	baseRevisions: readonly { target: TargetReference; revision: string }[];
	affectedTargets: readonly TargetReference[];
	beforeSummary: JsonValue;
	afterSummary: JsonValue;
	publicEffects: readonly string[];
	operationalEffects: readonly string[];
	estimatedCharges: readonly {
		amount: string;
		currency: string;
		description: string;
	}[];
	requiredPermissions: readonly string[];
	validationBlocks: readonly string[];
	rollbackCoverage: "none" | "database" | "compensating" | "full";
}

export interface CommandBindingContent {
	bindingHashVersion: number;
	plane: AuthoritativePlane;
	command: CommandReference;
	target: TargetReference;
	inputDigest: string;
	disclosure: string;
	amount?: string | undefined;
	currency?: string | undefined;
}

export type CommandAdmissionPolicy =
	| { kind: "automatic" }
	| { kind: "approval" }
	| {
			kind: "confirmation";
			standingPermission: "allowed" | "forbidden";
			freshOnly: boolean;
	  };

export interface CommandGrantFacts {
	bindingHashVersion: number;
	bindingHash: string;
	disclosure: string;
	amount?: string | undefined;
	currency?: string | undefined;
	businessId?: string | undefined;
	storeId?: string | undefined;
	baseRevisions?:
		| readonly { target: TargetReference; revision: string }[]
		| undefined;
}

export const commandGrantFactsSchema = z
	.object({
		bindingHashVersion: z.literal(1),
		bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
		disclosure: z.string().min(1).max(2_000),
		amount: z
			.string()
			.regex(/^(?:0|[1-9]\d{0,64})$/)
			.optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
		businessId: z.string().min(1).max(255).optional(),
		storeId: z.string().min(1).max(255).optional(),
		baseRevisions: z
			.array(
				z
					.object({
						target: targetReferenceSchema,
						revision: z.string().min(1).max(255),
					})
					.strict(),
			)
			.min(1)
			.max(250)
			.optional(),
	})
	.strict()
	.superRefine((facts, context) => {
		if ((facts.amount === undefined) !== (facts.currency === undefined)) {
			context.addIssue({
				code: "custom",
				message: "Command grant amount and currency must be supplied together.",
			});
		}
		if (facts.baseRevisions) {
			const targets = facts.baseRevisions.map(
				(revision) => `${revision.target.type}\0${revision.target.id}`,
			);
			if (new Set(targets).size !== targets.length) {
				context.addIssue({
					code: "custom",
					message: "Command grant base revisions must have unique targets.",
					path: ["baseRevisions"],
				});
			}
		}
	});

export function validateCommandGrantFacts(
	value: unknown,
	binding: {
		plane: AuthoritativePlane;
		command: CommandReference;
		target: TargetReference;
		inputDigest: string;
	},
): CommandGrantFacts {
	const parsed = commandGrantFactsSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error("Command grant facts are invalid.");
	}
	const expectedBindingHash = computeCommandBindingHash({
		bindingHashVersion: parsed.data.bindingHashVersion,
		plane: binding.plane,
		command: binding.command,
		target: binding.target,
		inputDigest: binding.inputDigest,
		disclosure: parsed.data.disclosure,
		...(parsed.data.amount === undefined
			? {}
			: { amount: parsed.data.amount, currency: parsed.data.currency }),
	});
	if (parsed.data.bindingHash !== expectedBindingHash) {
		throw new Error(
			"Command grant binding hash does not match its authoritative terms.",
		);
	}
	return parsed.data;
}

export interface CommandGrantAdmissionRequest<TTransaction> {
	executionId: string;
	principal: CommandPrincipal;
	plane: AuthoritativePlane;
	command: CommandReference;
	inputDigest: string;
	actor: ActorReference;
	authority: AuthoritySnapshot;
	target: TargetReference;
	policy: CommandAdmissionPolicy;
	approvalReference?: string | undefined;
	confirmationReference?: string | undefined;
	resolveFacts(
		transaction: TTransaction,
	): Promise<CommandGrantFacts> | CommandGrantFacts;
}

export type CommandGrantAdmissionResult =
	| { ok: true; grantUse: GrantUse }
	| { ok: false; failure: CommandFailure };

/** Plane-local adapter; callers never manipulate grant records directly. */
export interface CommandGrantAdapter<TTransaction> {
	admit(
		transaction: TTransaction,
		request: CommandGrantAdmissionRequest<TTransaction>,
	): Promise<CommandGrantAdmissionResult>;
	settle(
		transaction: TTransaction,
		executionId: string,
		outcome: "succeeded" | "definite_failure",
	): Promise<void>;
	markAmbiguous(transaction: TTransaction, executionId: string): Promise<void>;
	/** Re-check a consumed approval against current revisions in the handler tx. */
	revalidate?(
		transaction: TTransaction,
		request: CommandGrantAdmissionRequest<TTransaction>,
		grantUse: GrantUse,
	): Promise<CommandGrantAdmissionResult>;
	/** Persist fail-closed consequences, such as invalidating a drifted approval. */
	recordDenied?(
		transaction: TTransaction,
		request: CommandGrantAdmissionRequest<TTransaction>,
		failure: CommandFailure,
	): Promise<void>;
}

export function createConfirmationProof(id: string, nonce: string): string {
	return `${id}.${nonce}`;
}

function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`)
		.join(",")}}`;
}

function sha256(domain: string, version: number, value: JsonValue): string {
	if (version !== 1) throw new Error(`Unsupported ${domain} hash version.`);
	return createHash("sha256")
		.update(`${domain}\0v${version}\0`)
		.update(canonicalJson(value))
		.digest("hex");
}

function targetKey(target: TargetReference): string {
	return `${target.type}\0${target.id}`;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeBaseRevisions(
	values: readonly { target: TargetReference; revision: string }[],
): Array<{ target: TargetReference; revision: string }> {
	return [...values].sort((left, right) =>
		compareText(
			`${targetKey(left.target)}\0${left.revision}`,
			`${targetKey(right.target)}\0${right.revision}`,
		),
	);
}

function assertUniqueTargets(
	values: readonly TargetReference[],
	label: string,
): void {
	const keys = values.map(targetKey);
	if (new Set(keys).size !== keys.length) {
		throw new Error(`${label} must not contain duplicate targets.`);
	}
}

/** Hash contract for the exact immutable content shown for approval. */
export function computeChangeSetReviewHash(
	content: ChangeSetReviewContent,
): string {
	if (
		content.target.type !== content.proposal.target.type ||
		content.target.id !== content.proposal.target.id
	) {
		throw new Error("Change Set proposal target must match its owning target.");
	}
	assertUniqueTargets(
		content.baseRevisions.map((revision) => revision.target),
		"Change Set base revisions",
	);
	assertUniqueTargets(content.affectedTargets, "Change Set affected targets");
	if (
		!content.affectedTargets.some(
			(target) => targetKey(target) === targetKey(content.target),
		)
	) {
		throw new Error(
			"Change Set affected targets must include its owning target.",
		);
	}
	if (!/^[a-f0-9]{64}$/.test(content.proposal.inputDigest)) {
		throw new Error("Change Set proposal input digest is invalid.");
	}
	for (const charge of content.estimatedCharges) {
		if (
			!/^(?:0|[1-9]\d*)$/.test(charge.amount) ||
			!/^[A-Z]{3}$/.test(charge.currency)
		) {
			throw new Error("Change Set estimated charge is invalid.");
		}
	}
	const canonical: JsonValue = {
		ownerPlane: content.ownerPlane,
		target: content.target,
		proposal: {
			command: content.proposal.command,
			target: content.proposal.target,
			inputDigest: content.proposal.inputDigest,
			...(content.proposal.opaqueDraftReference
				? { opaqueDraftReference: content.proposal.opaqueDraftReference }
				: {}),
		},
		supersedesChangeSetId: content.supersedesChangeSetId ?? null,
		baseRevisions: normalizeBaseRevisions(content.baseRevisions),
		affectedTargets: [...content.affectedTargets].sort((left, right) =>
			compareText(targetKey(left), targetKey(right)),
		),
		beforeSummary: content.beforeSummary,
		afterSummary: content.afterSummary,
		publicEffects: [...content.publicEffects].sort(compareText),
		operationalEffects: [...content.operationalEffects].sort(compareText),
		estimatedCharges: [...content.estimatedCharges].sort((left, right) =>
			compareText(
				`${left.currency}\0${left.amount}\0${left.description}`,
				`${right.currency}\0${right.amount}\0${right.description}`,
			),
		),
		requiredPermissions: [...content.requiredPermissions].sort(compareText),
		validationBlocks: [...content.validationBlocks].sort(compareText),
		rollbackCoverage: content.rollbackCoverage,
	};
	return sha256(
		"86d.change_set.review",
		content.changeSetHashVersion,
		canonical,
	);
}

/** Hash contract for a one-time confirmation or standing grant decision. */
export function computeCommandBindingHash(
	content: CommandBindingContent,
): string {
	if ((content.amount === undefined) !== (content.currency === undefined)) {
		throw new Error(
			"Command binding amount and currency must be supplied together.",
		);
	}
	if (!/^[a-f0-9]{64}$/.test(content.inputDigest)) {
		throw new Error("Command binding input digest is invalid.");
	}
	if (
		content.amount !== undefined &&
		(!/^(?:0|[1-9]\d*)$/.test(content.amount) ||
			!/^[A-Z]{3}$/.test(content.currency ?? ""))
	) {
		throw new Error("Command binding amount or currency is invalid.");
	}
	return sha256("86d.command.binding", content.bindingHashVersion, {
		plane: content.plane,
		command: content.command,
		target: content.target,
		inputDigest: content.inputDigest,
		disclosure: content.disclosure,
		amount: content.amount ?? null,
		currency: content.currency ?? null,
	});
}

/** Keyed proof digest; the one-time nonce itself is never persisted. */
export function computeConfirmationNonceDigest(
	digestKey: string,
	nonce: string,
): string {
	if (new TextEncoder().encode(digestKey).byteLength < 32) {
		throw new Error("Confirmation nonce digest key must be at least 32 bytes.");
	}
	if (nonce.length < 32 || nonce.length > 512) {
		throw new Error(
			"Confirmation nonce must be between 32 and 512 characters.",
		);
	}
	return createHmac("sha256", digestKey)
		.update("86d.confirmation.nonce\0v1\0")
		.update(nonce)
		.digest("hex");
}
