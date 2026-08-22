import {
	type ActorReference,
	type AuthoritativePlane,
	type AuthoritySnapshot,
	type CommandFailure,
	type CommandReference,
	computeCommandBindingHash,
	type GrantUse,
	type TargetReference,
	targetReferenceSchema,
} from "@86d-app/contracts/command";

import { z } from "zod";
import type { CommandPrincipal } from "./command";
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
