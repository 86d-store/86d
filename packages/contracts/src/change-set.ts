import { z } from "zod";
import {
	type AuthoritativePlane,
	type CommandReference,
	commandReferenceSchema,
	type TargetReference,
	targetReferenceSchema,
} from "./command";
import { sha256Domain } from "./crypto";
import {
	currencySchema,
	dateTimeSchema,
	digestSchema,
	identifierSchema,
	type JsonValue,
	jsonValueSchema,
	minorAmountSchema,
	permissionSchema,
	versionSchema,
} from "./json-value";
export const baseRevisionSchema = z
	.object({
		target: targetReferenceSchema,
		revision: z.string().min(1).max(255),
	})
	.strict();

export const estimatedChargeSchema = z
	.object({
		amount: minorAmountSchema,
		currency: currencySchema,
		description: z.string().min(1).max(500),
	})
	.strict();

export const changeSetProposalSchema = z
	.object({
		command: commandReferenceSchema,
		target: targetReferenceSchema,
		inputDigest: digestSchema,
		opaqueDraftReference: identifierSchema.optional(),
	})
	.strict();

export const changeSetSchema = z
	.object({
		id: identifierSchema,
		version: versionSchema,
		changeSetHashVersion: versionSchema,
		ownerPlane: z.enum(["control_plane", "store_runtime"]),
		status: z.enum(["draft", "approved", "conflicted", "applied", "failed"]),
		reviewHash: digestSchema,
		target: targetReferenceSchema,
		proposal: changeSetProposalSchema,
		supersedesChangeSetId: identifierSchema.optional(),
		baseRevisions: z.array(baseRevisionSchema).min(1).max(250),
		affectedTargets: z.array(targetReferenceSchema).min(1).max(250),
		beforeSummary: jsonValueSchema,
		afterSummary: jsonValueSchema,
		publicEffects: z.array(z.string().min(1).max(500)).max(250),
		operationalEffects: z.array(z.string().min(1).max(500)).max(250),
		estimatedCharges: z.array(estimatedChargeSchema).max(250),
		requiredPermissions: z.array(permissionSchema).max(250),
		validationBlocks: z.array(z.string().min(1).max(500)).max(250),
		rollbackCoverage: z.enum(["none", "database", "compensating", "full"]),
		createdAt: dateTimeSchema,
		updatedAt: dateTimeSchema,
		immutableAt: dateTimeSchema.optional(),
	})
	.strict()
	.superRefine((changeSet, context) => {
		if (changeSet.changeSetHashVersion !== 1) {
			context.addIssue({
				code: "custom",
				message: "Unsupported Change Set hash version.",
				path: ["changeSetHashVersion"],
			});
		}
		if (
			changeSet.proposal.target.type !== changeSet.target.type ||
			changeSet.proposal.target.id !== changeSet.target.id
		) {
			context.addIssue({
				code: "custom",
				message: "Change Set proposal target must match its owning target.",
				path: ["proposal", "target"],
			});
		}
		if (
			!changeSet.affectedTargets.some(
				(target) =>
					target.type === changeSet.target.type &&
					target.id === changeSet.target.id,
			)
		) {
			context.addIssue({
				code: "custom",
				message: "Change Set affected targets must include its owning target.",
				path: ["affectedTargets"],
			});
		}
		if (
			(changeSet.status === "approved" || changeSet.status === "applied") &&
			changeSet.immutableAt === undefined
		) {
			context.addIssue({
				code: "custom",
				message: "Approved or applied Change Sets must be immutable.",
				path: ["immutableAt"],
			});
		}
		if (changeSet.supersedesChangeSetId === changeSet.id) {
			context.addIssue({
				code: "custom",
				message: "A Change Set cannot supersede itself.",
				path: ["supersedesChangeSetId"],
			});
		}
		const baseTargets = changeSet.baseRevisions.map(
			(revision) => `${revision.target.type}\0${revision.target.id}`,
		);
		if (new Set(baseTargets).size !== baseTargets.length) {
			context.addIssue({
				code: "custom",
				message: "Change Set base revisions must have unique targets.",
				path: ["baseRevisions"],
			});
		}
		const affectedTargets = changeSet.affectedTargets.map(
			(target) => `${target.type}\0${target.id}`,
		);
		if (new Set(affectedTargets).size !== affectedTargets.length) {
			context.addIssue({
				code: "custom",
				message: "Change Set affected targets must be unique.",
				path: ["affectedTargets"],
			});
		}
	});
export type ChangeSet = z.infer<typeof changeSetSchema>;

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
	if (content.changeSetHashVersion !== 1) {
		throw new RangeError("Unsupported Change Set hash version.");
	}
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
	return sha256Domain(
		"86d.change_set.review",
		content.changeSetHashVersion,
		canonical,
	);
}

export type { JsonValue } from "./json-value";
