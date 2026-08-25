import { createHmac } from "node:crypto";
import { z } from "zod";
import { hmacSha256Domain, requireDigestKey, sha256Domain } from "./crypto";
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

export type { JsonValue } from "./json-value";
// Public command entry intentionally re-exports wire helpers used by both planes.
// biome-ignore lint/performance/noBarrelFile: stable @86d-app/contracts/command surface
export {
	currencySchema,
	dateTimeSchema,
	digestSchema,
	identifierSchema,
	jsonValueSchema,
	minorAmountSchema,
	permissionSchema,
	versionSchema,
} from "./json-value";
export {
	assertCanonicalJson,
	canonicalJson,
	parseCanonicalJson,
	toJsonValue,
} from "./serialize";
export const authoritativePlaneSchema = z.enum([
	"control_plane",
	"store_runtime",
]);
export type AuthoritativePlane = z.infer<typeof authoritativePlaneSchema>;

export const actionLevelSchema = z.enum([
	"automatic",
	"approve",
	"confirm_now",
]);
export type ActionLevel = z.infer<typeof actionLevelSchema>;

export const commandReferenceSchema = z
	.object({
		name: z
			.string()
			.min(3)
			.max(200)
			.regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
		version: versionSchema,
	})
	.strict();
export type CommandReference = z.infer<typeof commandReferenceSchema>;

export const targetReferenceSchema = z
	.object({
		type: z.enum([
			"account",
			"business",
			"store",
			"connection",
			"resource",
			"workflow",
		]),
		id: identifierSchema,
	})
	.strict();
export type TargetReference = z.infer<typeof targetReferenceSchema>;

/** Cross-plane actor types. Store Runtime principals map into these wire types. */
export const actorReferenceSchema = z
	.object({
		type: z.enum(["account", "agent", "operator", "workload", "system"]),
		id: identifierSchema,
	})
	.strict();
export type ActorReference = z.infer<typeof actorReferenceSchema>;

export const authoritySnapshotSchema = z
	.object({
		id: identifierSchema,
		type: z.enum([
			"account_owner",
			"business_membership",
			"store_membership",
			"custom_role",
			"standing_permission",
			"workload_grant",
			"system_grant",
		]),
		role: z.string().min(1).max(100).optional(),
		permissions: z.array(permissionSchema).max(250),
		businessId: identifierSchema.optional(),
		storeId: identifierSchema.optional(),
	})
	.strict();
export type AuthoritySnapshot = z.infer<typeof authoritySnapshotSchema>;

export const commandRequestSchema = z
	.object({
		command: commandReferenceSchema,
		idempotencyKey: z.string().min(8).max(200),
		target: targetReferenceSchema,
		input: jsonValueSchema,
		approvalReference: identifierSchema.optional(),
		confirmationReference: identifierSchema.optional(),
	})
	.strict();
export type CommandRequest = z.infer<typeof commandRequestSchema>;

export const commandFailureCodeSchema = z.enum([
	"invalid_request",
	"unknown_command",
	"unauthenticated",
	"forbidden",
	"target_not_found",
	"invalid_input",
	"idempotency_conflict",
	"approval_required",
	"approval_invalid",
	"confirmation_required",
	"confirmation_invalid",
	"standing_permission_exhausted",
	"invalid_result",
	"execution_failed",
	"temporarily_unavailable",
	"contract_version_mismatch",
]);
export type CommandFailureCode = z.infer<typeof commandFailureCodeSchema>;

/** Shown after internal details are redacted at the durable Command boundary. */
export const COMMAND_FAILURE_MESSAGE = "This action could not be completed.";

export const NORMALIZED_FAILURE_CATALOG = {
	invalid_request: { retryable: false },
	unknown_command: { retryable: false },
	unauthenticated: { retryable: false },
	forbidden: { retryable: false },
	target_not_found: { retryable: false },
	invalid_input: { retryable: false },
	idempotency_conflict: { retryable: false },
	approval_required: { retryable: false },
	approval_invalid: { retryable: false },
	confirmation_required: { retryable: false },
	confirmation_invalid: { retryable: false },
	standing_permission_exhausted: { retryable: false },
	invalid_result: { retryable: false },
	execution_failed: { retryable: true },
	temporarily_unavailable: { retryable: true },
	contract_version_mismatch: { retryable: false },
} as const satisfies Record<
	CommandFailureCode,
	{ readonly retryable: boolean }
>;

export const commandFailureSchema = z
	.object({
		code: commandFailureCodeSchema,
		message: z.string().min(1).max(500),
		retryable: z.boolean(),
		details: jsonValueSchema.optional(),
	})
	.strict();
export type CommandFailure = z.infer<typeof commandFailureSchema>;

export function normalizedFailure(
	code: CommandFailureCode,
	message: string = COMMAND_FAILURE_MESSAGE,
	details?: JsonValue,
): CommandFailure {
	return {
		code,
		message,
		retryable: NORMALIZED_FAILURE_CATALOG[code].retryable,
		...(details === undefined ? {} : { details }),
	};
}

export const commandStatusSchema = z.enum([
	"pending",
	"running",
	"succeeded",
	"failed",
]);
export type CommandStatus = z.infer<typeof commandStatusSchema>;

const commandReceiptBaseSchema = z.object({
	executionId: identifierSchema,
	command: commandReferenceSchema,
	target: targetReferenceSchema,
	idempotencyKey: z.string().min(8).max(200),
	actionLevel: actionLevelSchema,
	replayed: z.boolean(),
	startedAt: dateTimeSchema,
});

export const commandReceiptSchema = z.discriminatedUnion("status", [
	commandReceiptBaseSchema
		.extend({
			status: z.literal("pending"),
		})
		.strict(),
	commandReceiptBaseSchema
		.extend({
			status: z.literal("running"),
		})
		.strict(),
	commandReceiptBaseSchema
		.extend({
			status: z.literal("succeeded"),
			completedAt: dateTimeSchema,
			result: jsonValueSchema,
		})
		.strict(),
	commandReceiptBaseSchema
		.extend({
			status: z.literal("failed"),
			completedAt: dateTimeSchema,
			failure: commandFailureSchema,
		})
		.strict(),
]);
export type CommandReceipt = z.infer<typeof commandReceiptSchema>;

export const commandExecutionResponseSchema = z.discriminatedUnion("ok", [
	z
		.object({
			ok: z.literal(true),
			receipt: commandReceiptSchema,
		})
		.strict(),
	z
		.object({
			ok: z.literal(false),
			failure: commandFailureSchema,
			receipt: commandReceiptSchema.optional(),
		})
		.strict(),
]);
export type CommandExecutionResponse = z.infer<
	typeof commandExecutionResponseSchema
>;

export const workflowStateSchema = z.enum([
	"pending",
	"running",
	"completed",
	"rolled_back",
	"failed",
	"needs_attention",
]);
export type WorkflowState = z.infer<typeof workflowStateSchema>;

export const workflowSchema = z
	.object({
		id: identifierSchema,
		version: versionSchema,
		name: commandReferenceSchema.shape.name,
		state: workflowStateSchema,
		target: targetReferenceSchema,
		commandExecutionId: identifierSchema.optional(),
		currentStep: z.string().min(1).max(200).optional(),
		failure: commandFailureSchema.optional(),
		createdAt: dateTimeSchema,
		updatedAt: dateTimeSchema,
		completedAt: dateTimeSchema.optional(),
	})
	.strict();
export type Workflow = z.infer<typeof workflowSchema>;

export const workflowStepSchema = z
	.object({
		id: identifierSchema,
		workflowId: identifierSchema,
		name: z.string().min(1).max(200),
		position: z.number().int().nonnegative(),
		state: workflowStateSchema,
		providerReference: z.string().min(1).max(500).optional(),
		failure: commandFailureSchema.optional(),
		leaseOwner: z.string().min(1).max(255).optional(),
		leaseExpiresAt: dateTimeSchema.optional(),
		createdAt: dateTimeSchema,
		updatedAt: dateTimeSchema,
	})
	.strict();
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowAttemptSchema = z
	.object({
		id: identifierSchema,
		stepId: identifierSchema,
		attempt: z.number().int().positive(),
		state: z.enum(["pending", "running", "succeeded", "failed", "ambiguous"]),
		operationKey: z.string().min(1).max(500),
		providerReference: z.string().min(1).max(500).optional(),
		failure: commandFailureSchema.optional(),
		startedAt: dateTimeSchema,
		finishedAt: dateTimeSchema.optional(),
	})
	.strict();
export type WorkflowAttempt = z.infer<typeof workflowAttemptSchema>;

export const approvalSchema = z
	.object({
		id: identifierSchema,
		changeSetId: identifierSchema,
		reviewHash: digestSchema,
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
			.max(250),
		actor: actorReferenceSchema.refine((actor) => actor.type === "account", {
			message: "Approval requires a human Account actor.",
		}),
		authority: authoritySnapshotSchema,
		approvedAt: dateTimeSchema,
		invalidatedAt: dateTimeSchema.optional(),
	})
	.strict()
	.superRefine((approval, context) => {
		if (
			approval.invalidatedAt !== undefined &&
			Date.parse(approval.invalidatedAt) < Date.parse(approval.approvedAt)
		) {
			context.addIssue({
				code: "custom",
				message: "Approval invalidation cannot predate approval.",
				path: ["invalidatedAt"],
			});
		}
		const targets = approval.baseRevisions.map(
			(revision) => `${revision.target.type}\0${revision.target.id}`,
		);
		if (new Set(targets).size !== targets.length) {
			context.addIssue({
				code: "custom",
				message: "Approval base revisions must have unique targets.",
				path: ["baseRevisions"],
			});
		}
	});
export type Approval = z.infer<typeof approvalSchema>;

export const confirmationSchema = z
	.object({
		id: identifierSchema,
		actor: actorReferenceSchema.refine((actor) => actor.type === "account", {
			message: "Confirmation requires a human Account actor.",
		}),
		sessionId: identifierSchema,
		target: targetReferenceSchema,
		command: commandReferenceSchema,
		bindingHashVersion: versionSchema,
		bindingHash: digestSchema,
		nonceDigest: digestSchema,
		disclosure: z.string().min(1).max(2_000),
		amount: minorAmountSchema.optional(),
		currency: currencySchema.optional(),
		createdAt: dateTimeSchema,
		expiresAt: dateTimeSchema,
		consumedAt: dateTimeSchema.optional(),
	})
	.strict()
	.superRefine((confirmation, context) => {
		if (confirmation.bindingHashVersion !== 1) {
			context.addIssue({
				code: "custom",
				message: "Unsupported confirmation binding hash version.",
				path: ["bindingHashVersion"],
			});
		}
		if (
			(confirmation.amount === undefined) !==
			(confirmation.currency === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Confirmation amount and currency must be supplied together.",
			});
		}
		if (
			Date.parse(confirmation.expiresAt) <= Date.parse(confirmation.createdAt)
		) {
			context.addIssue({
				code: "custom",
				message: "Confirmation expiry must be after creation.",
				path: ["expiresAt"],
			});
		}
		if (
			confirmation.consumedAt !== undefined &&
			(Date.parse(confirmation.consumedAt) <
				Date.parse(confirmation.createdAt) ||
				Date.parse(confirmation.consumedAt) >=
					Date.parse(confirmation.expiresAt))
		) {
			context.addIssue({
				code: "custom",
				message: "Confirmation consumption cannot predate creation.",
				path: ["consumedAt"],
			});
		}
	});
export type Confirmation = z.infer<typeof confirmationSchema>;

export const confirmationChallengeSchema = z
	.object({
		reference: z.string().min(3).max(255),
		command: commandReferenceSchema,
		target: targetReferenceSchema,
		disclosure: z.string().min(1).max(2_000),
		expiresAt: dateTimeSchema,
		amount: minorAmountSchema.optional(),
		currency: currencySchema.optional(),
	})
	.strict()
	.superRefine((challenge, context) => {
		if (
			(challenge.amount === undefined) !==
			(challenge.currency === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Challenge amount and currency must be supplied together.",
			});
		}
	});
export type ConfirmationChallenge = z.infer<typeof confirmationChallengeSchema>;

export const standingPermissionSchema = z
	.object({
		id: identifierSchema,
		grantee: actorReferenceSchema,
		grantor: actorReferenceSchema,
		authority: authoritySnapshotSchema,
		businessId: identifierSchema,
		storeId: identifierSchema.optional(),
		action: commandReferenceSchema,
		validFrom: dateTimeSchema,
		validUntil: dateTimeSchema,
		perOperationAmount: minorAmountSchema.optional(),
		aggregateAmount: minorAmountSchema.optional(),
		currency: currencySchema.optional(),
		createdAt: dateTimeSchema,
		revokedAt: dateTimeSchema.optional(),
	})
	.strict()
	.superRefine((permission, context) => {
		if (Date.parse(permission.validUntil) <= Date.parse(permission.validFrom)) {
			context.addIssue({
				code: "custom",
				message: "Standing permission validity must have a positive duration.",
				path: ["validUntil"],
			});
		}
		const financialFields = [
			permission.perOperationAmount,
			permission.aggregateAmount,
			permission.currency,
		];
		const supplied = financialFields.filter(
			(value) => value !== undefined,
		).length;
		if (supplied !== 0 && supplied !== financialFields.length) {
			context.addIssue({
				code: "custom",
				message:
					"Standing permission financial limits and currency must be supplied together.",
			});
		}
		if (
			permission.perOperationAmount !== undefined &&
			permission.aggregateAmount !== undefined &&
			BigInt(permission.aggregateAmount) < BigInt(permission.perOperationAmount)
		) {
			context.addIssue({
				code: "custom",
				message: "Aggregate authority cannot be below the per-operation cap.",
				path: ["aggregateAmount"],
			});
		}
	});
export type StandingPermission = z.infer<typeof standingPermissionSchema>;

export const standingPermissionUseReservationSchema = z
	.object({
		id: identifierSchema,
		standingPermissionId: identifierSchema,
		commandExecutionId: identifierSchema,
		amount: minorAmountSchema.optional(),
		currency: currencySchema.optional(),
		state: z.enum(["reserved", "committed", "released", "ambiguous"]),
		createdAt: dateTimeSchema,
		updatedAt: dateTimeSchema,
	})
	.strict()
	.superRefine((reservation, context) => {
		if (
			(reservation.amount === undefined) !==
			(reservation.currency === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Reservation amount and currency must be supplied together.",
			});
		}
	});
export type StandingPermissionUseReservation = z.infer<
	typeof standingPermissionUseReservationSchema
>;
/** @deprecated Prefer standingPermissionUseReservationSchema */
export const permissionUseSchema = standingPermissionUseReservationSchema;
export type PermissionUse = StandingPermissionUseReservation;

const standingPermissionGrantUseSchema = z
	.object({
		kind: z.literal("standing_permission"),
		standingPermissionId: identifierSchema,
		reservationId: identifierSchema,
		amount: minorAmountSchema.optional(),
		currency: currencySchema.optional(),
	})
	.strict()
	.superRefine((grantUse, context) => {
		if ((grantUse.amount === undefined) !== (grantUse.currency === undefined)) {
			context.addIssue({
				code: "custom",
				message:
					"Standing grant amount and currency must be supplied together.",
			});
		}
	});

export const grantUseSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("automatic") }).strict(),
	z
		.object({
			kind: z.literal("approval"),
			approvalId: identifierSchema,
			changeSetId: identifierSchema,
			reviewHash: digestSchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("confirmation"),
			confirmationId: identifierSchema,
			bindingHash: digestSchema,
		})
		.strict(),
	standingPermissionGrantUseSchema,
]);
export type GrantUse = z.infer<typeof grantUseSchema>;

export const auditEventSchema = z
	.object({
		id: identifierSchema,
		version: versionSchema,
		plane: authoritativePlaneSchema,
		type: z
			.string()
			.min(3)
			.max(200)
			.regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
		actor: actorReferenceSchema,
		authority: authoritySnapshotSchema,
		target: targetReferenceSchema,
		command: commandReferenceSchema.optional(),
		workflowId: identifierSchema.optional(),
		occurredAt: dateTimeSchema,
		data: jsonValueSchema,
	})
	.strict();
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const COMMAND_TRANSITIONS: Readonly<
	Record<CommandStatus, readonly CommandStatus[]>
> = {
	pending: ["running", "failed"],
	running: ["succeeded", "failed"],
	succeeded: [],
	failed: [],
};

export const WORKFLOW_TRANSITIONS: Readonly<
	Record<WorkflowState, readonly WorkflowState[]>
> = {
	pending: ["running", "failed"],
	running: ["completed", "rolled_back", "failed", "needs_attention"],
	completed: [],
	rolled_back: [],
	failed: ["running"],
	needs_attention: ["running", "failed", "rolled_back"],
};

export function canTransitionCommand(from: unknown, to: unknown): boolean {
	const parsedFrom = commandStatusSchema.safeParse(from);
	const parsedTo = commandStatusSchema.safeParse(to);
	return (
		parsedFrom.success &&
		parsedTo.success &&
		COMMAND_TRANSITIONS[parsedFrom.data].includes(parsedTo.data)
	);
}

export function canTransitionWorkflow(from: unknown, to: unknown): boolean {
	const parsedFrom = workflowStateSchema.safeParse(from);
	const parsedTo = workflowStateSchema.safeParse(to);
	return (
		parsedFrom.success &&
		parsedTo.success &&
		WORKFLOW_TRANSITIONS[parsedFrom.data].includes(parsedTo.data)
	);
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

/** Hash contract for a one-time confirmation or standing grant decision. */
export function computeCommandBindingHash(
	content: CommandBindingContent,
): string {
	if (content.bindingHashVersion !== 1) {
		throw new RangeError("Unsupported Command binding hash version.");
	}
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
	return sha256Domain("86d.command.binding", content.bindingHashVersion, {
		plane: content.plane,
		command: content.command,
		target: content.target,
		inputDigest: content.inputDigest,
		disclosure: content.disclosure,
		amount: content.amount ?? null,
		currency: content.currency ?? null,
	});
}

/** Private, plane-local HMAC over the exact authoritative Command input. */
export function computeCommandInputDigest(
	key: string,
	content: {
		plane: AuthoritativePlane;
		command: CommandReference;
		target: TargetReference;
		input: JsonValue;
	},
): string {
	requireDigestKey(key, "Command digest key");
	return hmacSha256Domain(key, "86d.command.input", 2, content);
}

/** Keyed proof digest; the one-time nonce itself is never persisted. */
export function computeConfirmationNonceDigest(
	digestKey: string,
	nonce: string,
): string {
	requireDigestKey(digestKey, "Confirmation nonce digest key");
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
