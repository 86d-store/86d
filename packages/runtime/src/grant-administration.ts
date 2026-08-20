import { randomUUID } from "node:crypto";
import {
	type ActorReference,
	type Approval,
	type AuditEvent,
	type AuthoritySnapshot,
	actorReferenceSchema,
	approvalSchema,
	auditEventSchema,
	authoritySnapshotSchema,
	baseRevisionSchema,
	type ChangeSet,
	changeSetProposalSchema,
	changeSetSchema,
	estimatedChargeSchema,
	jsonValueSchema,
	type StandingPermission,
	standingPermissionSchema,
	type TargetReference,
	targetReferenceSchema,
} from "@86d-app/core/commands";
import { z } from "zod";
import type { CommandPrincipal } from "./command";
import {
	type ChangeSetReviewContent,
	type CommandAdmissionPolicy,
	computeChangeSetReviewHash,
	normalizeBaseRevisions,
} from "./grants";

export interface PrismaGrantAdministrationTransaction {
	changeSet: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	approval: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	standingPermission: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	standingPermissionUseReservation: {
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	auditEvent: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
	};
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface PrismaGrantAdministrationClient<
	TTransaction extends PrismaGrantAdministrationTransaction,
> {
	$transaction<T>(run: (transaction: TTransaction) => Promise<T>): Promise<T>;
}

export interface GrantTargetScope {
	businessId: string;
	storeId?: string | undefined;
}

const principalSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("session"),
			credentialId: z.string().min(1).max(255),
			sessionId: z.string().min(1).max(255),
		})
		.strict(),
	z
		.object({
			type: z.literal("workload"),
			credentialId: z.string().min(1).max(255),
		})
		.strict(),
	z
		.object({
			type: z.literal("system"),
			credentialId: z.string().min(1).max(255),
		})
		.strict(),
]);

const identifierSchema = z.string().min(1).max(255);
const permissionSchema = z.string().min(1).max(200);
const changeSetReviewContentSchema = z
	.object({
		changeSetHashVersion: z.literal(1),
		ownerPlane: z.literal("store_runtime"),
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
	})
	.strict()
	.superRefine((content, context) => {
		if (
			content.target.type !== content.proposal.target.type ||
			content.target.id !== content.proposal.target.id
		) {
			context.addIssue({
				code: "custom",
				message: "Change Set proposal target must match its owning target.",
				path: ["proposal", "target"],
			});
		}
		const baseTargets = content.baseRevisions.map(targetKeyFromRevision);
		if (new Set(baseTargets).size !== baseTargets.length) {
			context.addIssue({
				code: "custom",
				message: "Change Set base revisions must have unique targets.",
				path: ["baseRevisions"],
			});
		}
		const affectedTargets = content.affectedTargets.map(targetKey);
		if (new Set(affectedTargets).size !== affectedTargets.length) {
			context.addIssue({
				code: "custom",
				message: "Change Set affected targets must be unique.",
				path: ["affectedTargets"],
			});
		}
		if (!affectedTargets.includes(targetKey(content.target))) {
			context.addIssue({
				code: "custom",
				message: "Change Set affected targets must include its owning target.",
				path: ["affectedTargets"],
			});
		}
	});

const createChangeSetInputSchema = z
	.object({ principal: principalSchema, content: changeSetReviewContentSchema })
	.strict();
const approveChangeSetInputSchema = z
	.object({ principal: principalSchema, changeSetId: identifierSchema })
	.strict();
const rebaseChangeSetInputSchema = z
	.object({
		principal: principalSchema,
		changeSetId: identifierSchema,
		content: changeSetReviewContentSchema,
	})
	.strict();
const standingPermissionInputSchema = z
	.object({
		principal: principalSchema,
		grantee: actorReferenceSchema,
		businessId: identifierSchema,
		storeId: identifierSchema.optional(),
		action: z
			.object({
				name: z
					.string()
					.min(3)
					.max(200)
					.regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
				version: z.number().int().positive(),
			})
			.strict(),
		validFrom: z.string().datetime(),
		validUntil: z.string().datetime(),
		perOperationAmount: z
			.string()
			.regex(/^(?:0|[1-9]\d*)$/)
			.optional(),
		aggregateAmount: z
			.string()
			.regex(/^(?:0|[1-9]\d*)$/)
			.optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
	})
	.strict();
const revokeStandingPermissionInputSchema = z
	.object({
		principal: principalSchema,
		standingPermissionId: identifierSchema,
		businessId: identifierSchema,
		storeId: identifierSchema.optional(),
	})
	.strict();
const resolveReservationInputSchema = z
	.object({
		principal: principalSchema,
		commandExecutionId: identifierSchema,
		businessId: identifierSchema,
		storeId: identifierSchema.optional(),
		outcome: z.enum(["succeeded", "definite_failure"]),
		evidenceReference: z.string().min(1).max(500),
	})
	.strict();

const admissionPolicySchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("automatic") }).strict(),
	z.object({ kind: z.literal("approval") }).strict(),
	z
		.object({
			kind: z.literal("confirmation"),
			standingPermission: z.enum(["allowed", "forbidden"]),
			freshOnly: z.boolean(),
		})
		.strict(),
]);
const authorizationSchema = z
	.object({ actor: actorReferenceSchema, authority: authoritySnapshotSchema })
	.strict();

type GrantOperation =
	| "change_set.create"
	| "change_set.approve"
	| "change_set.rebase"
	| "standing_permission.create"
	| "standing_permission.revoke"
	| "standing_permission.resolve_ambiguous";

export interface PrismaStoreGrantAdministrationOptions<
	TTransaction extends PrismaGrantAdministrationTransaction,
> {
	createId?:
		| ((
				kind: "approval" | "audit_event" | "change_set" | "standing_permission",
		  ) => string)
		| undefined;
	/** Resolves current authority from the server-authenticated principal. */
	authorize(
		transaction: TTransaction,
		request: {
			principal: CommandPrincipal;
			targets: readonly TargetReference[];
			requiredPermissions: readonly string[];
			operation: GrantOperation;
		},
	): Promise<{ actor: ActorReference; authority: AuthoritySnapshot } | null>;
	resolveTargetScope(
		transaction: TTransaction,
		target: TargetReference,
	): Promise<GrantTargetScope | null>;
	resolveCurrentBaseRevisions(
		transaction: TTransaction,
		content: ChangeSetReviewContent,
	): Promise<ChangeSetReviewContent["baseRevisions"]>;
	resolveActionPolicy(
		transaction: TTransaction,
		action: { name: string; version: number },
	): Promise<CommandAdmissionPolicy | null>;
}

export interface StoreGrantAdministration {
	createChangeSet(input: {
		principal: CommandPrincipal;
		content: ChangeSetReviewContent;
	}): Promise<ChangeSet>;
	approveChangeSet(input: {
		principal: CommandPrincipal;
		changeSetId: string;
	}): Promise<
		| { ok: true; changeSet: ChangeSet; approval: Approval }
		| { ok: false; reason: "conflicted" | "invalid"; changeSet: ChangeSet }
	>;
	rebaseChangeSet(input: {
		principal: CommandPrincipal;
		changeSetId: string;
		content: ChangeSetReviewContent;
	}): Promise<ChangeSet>;
	createStandingPermission(input: {
		principal: CommandPrincipal;
		grantee: ActorReference;
		businessId: string;
		storeId?: string | undefined;
		action: { name: string; version: number };
		validFrom: string;
		validUntil: string;
		perOperationAmount?: string | undefined;
		aggregateAmount?: string | undefined;
		currency?: string | undefined;
	}): Promise<StandingPermission>;
	revokeStandingPermission(input: {
		principal: CommandPrincipal;
		standingPermissionId: string;
		businessId: string;
		storeId?: string | undefined;
	}): Promise<void>;
	resolveAmbiguousStandingReservation(input: {
		principal: CommandPrincipal;
		commandExecutionId: string;
		businessId: string;
		storeId?: string | undefined;
		outcome: "succeeded" | "definite_failure";
		evidenceReference: string;
	}): Promise<{
		reservationId: string;
		state: "committed" | "released";
		resolvedAt: string;
	}>;
}

function targetKey(target: { type: string; id: string }): string {
	return `${target.type}\0${target.id}`;
}

function targetKeyFromRevision(revision: {
	target: { type: string; id: string };
}): string {
	return targetKey(revision.target);
}

function uniqueTargets(values: readonly TargetReference[]): TargetReference[] {
	return [
		...new Map(values.map((target) => [targetKey(target), target])).values(),
	];
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
		.join(",")}}`;
}

function canonicalRevisions(
	revisions: readonly { target: TargetReference; revision: string }[],
): string {
	return canonical(normalizeBaseRevisions(revisions));
}

function scopeMatches(
	authority: AuthoritySnapshot,
	target: TargetReference,
	scope: GrantTargetScope,
): boolean {
	if (!authority.businessId || authority.businessId !== scope.businessId) {
		return false;
	}
	if (target.type === "business") {
		return (
			target.id === scope.businessId &&
			scope.storeId === undefined &&
			authority.storeId === undefined
		);
	}
	if (target.type === "store" && scope.storeId !== target.id) return false;
	return authority.storeId === undefined || authority.storeId === scope.storeId;
}

function changeSetCreateData(changeSet: ChangeSet): Record<string, unknown> {
	return {
		id: changeSet.id,
		version: changeSet.version,
		changeSetHashVersion: changeSet.changeSetHashVersion,
		ownerPlane: changeSet.ownerPlane,
		status: changeSet.status,
		reviewHash: changeSet.reviewHash,
		targetType: changeSet.target.type,
		targetId: changeSet.target.id,
		target: changeSet.target,
		proposal: changeSet.proposal,
		...(changeSet.supersedesChangeSetId
			? { supersedesChangeSetId: changeSet.supersedesChangeSetId }
			: {}),
		baseRevisions: changeSet.baseRevisions,
		affectedTargets: changeSet.affectedTargets,
		beforeSummary: changeSet.beforeSummary,
		afterSummary: changeSet.afterSummary,
		publicEffects: changeSet.publicEffects,
		operationalEffects: changeSet.operationalEffects,
		estimatedCharges: changeSet.estimatedCharges,
		requiredPermissions: changeSet.requiredPermissions,
		validationBlocks: changeSet.validationBlocks,
		rollbackCoverage: changeSet.rollbackCoverage,
		createdAt: new Date(changeSet.createdAt),
		updatedAt: new Date(changeSet.updatedAt),
	};
}

function auditCreateData(event: AuditEvent): Record<string, unknown> {
	return {
		id: event.id,
		version: event.version,
		plane: event.plane,
		eventType: event.type,
		actorType: event.actor.type,
		actorId: event.actor.id,
		actor: event.actor,
		authorityType: event.authority.type,
		authorityId: event.authority.id,
		authority: event.authority,
		targetType: event.target.type,
		targetId: event.target.id,
		target: event.target,
		...(event.command
			? {
					commandName: event.command.name,
					commandVersion: event.command.version,
				}
			: {}),
		occurredAt: new Date(event.occurredAt),
		data: event.data,
	};
}

function databaseDate(value: unknown): Date {
	const parsed =
		value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
	if (!Number.isFinite(parsed.getTime())) {
		throw new Error("The database did not return a valid grant decision time.");
	}
	return parsed;
}

async function databaseNow<T extends PrismaGrantAdministrationTransaction>(
	transaction: T,
): Promise<Date> {
	const rows = await transaction.$queryRawUnsafe<Array<{ now: Date | string }>>(
		'SELECT clock_timestamp() AS "now"',
	);
	return databaseDate(rows[0]?.now);
}

function iso(value: unknown): string {
	return databaseDate(value).toISOString();
}

function parseLockedChangeSet(value: unknown): ChangeSet {
	if (!value || typeof value !== "object") {
		throw new Error("The Change Set record is invalid.");
	}
	const record = value as Record<string, unknown>;
	const { immutableAt, supersedesChangeSetId, ...required } = record;
	return changeSetSchema.parse({
		...required,
		...(supersedesChangeSetId == null ? {} : { supersedesChangeSetId }),
		createdAt: iso(record.createdAt),
		updatedAt: iso(record.updatedAt),
		...(immutableAt == null ? {} : { immutableAt: iso(immutableAt) }),
	});
}

const lockedChangeSetQuery = `SELECT jsonb_build_object(
  'id', c."id", 'version', c."version", 'changeSetHashVersion', c."changeSetHashVersion",
  'ownerPlane', c."ownerPlane", 'status', c."status", 'reviewHash', c."reviewHash",
  'target', c."target", 'proposal', c."proposal", 'supersedesChangeSetId', c."supersedesChangeSetId",
  'baseRevisions', c."baseRevisions", 'affectedTargets', c."affectedTargets",
  'beforeSummary', c."beforeSummary", 'afterSummary', c."afterSummary",
  'publicEffects', c."publicEffects", 'operationalEffects', c."operationalEffects",
  'estimatedCharges', c."estimatedCharges", 'requiredPermissions', c."requiredPermissions",
  'validationBlocks', c."validationBlocks", 'rollbackCoverage', c."rollbackCoverage",
  'createdAt', c."createdAt", 'updatedAt', c."updatedAt", 'immutableAt', c."immutableAt"
) AS "changeSet" FROM "ChangeSet" c WHERE c."id" = $1 FOR UPDATE`;

/** Durable, Store-plane grant lifecycle administration behind one interface. */
export function createPrismaStoreGrantAdministration<
	TTransaction extends PrismaGrantAdministrationTransaction,
>(
	client: PrismaGrantAdministrationClient<TTransaction>,
	options: PrismaStoreGrantAdministrationOptions<TTransaction>,
): StoreGrantAdministration {
	const createId =
		options.createId ??
		((
			kind: "approval" | "audit_event" | "change_set" | "standing_permission",
		) => `${kind}-${randomUUID()}`);

	async function authorize(
		transaction: TTransaction,
		input: {
			principal: CommandPrincipal;
			targets: readonly TargetReference[];
			requiredPermissions: readonly string[];
			operation: GrantOperation;
		},
	): Promise<{ actor: ActorReference; authority: AuthoritySnapshot }> {
		const principal = principalSchema.parse(input.principal);
		const targets = uniqueTargets(input.targets);
		const requiredPermissions = [...new Set(input.requiredPermissions)];
		const authorization = authorizationSchema.safeParse(
			await options.authorize(transaction, {
				principal,
				targets,
				requiredPermissions,
				operation: input.operation,
			}),
		);
		if (!authorization.success) {
			throw new Error("The principal cannot administer this grant.");
		}
		if (
			!requiredPermissions.every((permission) =>
				authorization.data.authority.permissions.includes(permission),
			)
		) {
			throw new Error("The principal cannot administer this grant.");
		}
		for (const target of targets) {
			const scope = await options.resolveTargetScope(transaction, target);
			if (
				!scope ||
				!scopeMatches(authorization.data.authority, target, scope)
			) {
				throw new Error("The principal cannot administer this grant.");
			}
		}
		return authorization.data;
	}

	function requireHumanOwner(
		principal: CommandPrincipal,
		administrator: {
			actor: ActorReference;
			authority: AuthoritySnapshot;
		},
	): void {
		if (
			principal.type !== "session" ||
			administrator.actor.type !== "account" ||
			administrator.authority.role !== "owner"
		) {
			throw new Error("A Store owner must administer this grant.");
		}
	}

	function contentTargets(content: ChangeSetReviewContent): TargetReference[] {
		return uniqueTargets([
			content.target,
			content.proposal.target,
			...content.affectedTargets,
			...content.baseRevisions.map((revision) => revision.target),
		]);
	}

	async function persistChangeSet(
		transaction: TTransaction,
		input: {
			content: ChangeSetReviewContent;
			actor: ActorReference;
			authority: AuthoritySnapshot;
			supersedesChangeSetId?: string | undefined;
		},
	): Promise<ChangeSet> {
		if (input.content.supersedesChangeSetId !== undefined) {
			throw new Error(
				"Change Set lineage may only be assigned by an authorized rebase.",
			);
		}
		const timestamp = await databaseNow(transaction);
		const id = createId("change_set");
		const hashContent = {
			...input.content,
			...(input.supersedesChangeSetId
				? { supersedesChangeSetId: input.supersedesChangeSetId }
				: {}),
		};
		const changeSet = changeSetSchema.parse({
			id,
			version: 1,
			...hashContent,
			status: "draft",
			reviewHash: computeChangeSetReviewHash(hashContent),
			createdAt: timestamp.toISOString(),
			updatedAt: timestamp.toISOString(),
		});
		await transaction.changeSet.create({
			data: changeSetCreateData(changeSet),
		});
		const audit = auditEventSchema.parse({
			id: createId("audit_event"),
			version: 1,
			plane: "store_runtime",
			type: "change_set.created",
			actor: input.actor,
			authority: input.authority,
			target: changeSet.target,
			occurredAt: timestamp.toISOString(),
			data: {
				changeSetId: changeSet.id,
				reviewHash: changeSet.reviewHash,
				...(input.supersedesChangeSetId
					? { supersedesChangeSetId: input.supersedesChangeSetId }
					: {}),
			},
		});
		await transaction.auditEvent.create({ data: auditCreateData(audit) });
		return changeSet;
	}

	async function lockChangeSet(
		transaction: TTransaction,
		id: string,
	): Promise<ChangeSet> {
		const rows = await transaction.$queryRawUnsafe<
			Array<{ changeSet: unknown }>
		>(lockedChangeSetQuery, id);
		if (!rows[0]) throw new Error("Change Set not found.");
		return parseLockedChangeSet(rows[0].changeSet);
	}

	async function conflictChangeSet(input: {
		transaction: TTransaction;
		changeSet: ChangeSet;
		actor: ActorReference;
		authority: AuthoritySnapshot;
	}): Promise<ChangeSet> {
		const timestamp = await databaseNow(input.transaction);
		if (input.changeSet.status !== "conflicted") {
			const updated = await input.transaction.changeSet.updateMany({
				where: { id: input.changeSet.id, status: input.changeSet.status },
				data: { status: "conflicted", updatedAt: timestamp },
			});
			if (updated.count !== 1) {
				throw new Error("The Change Set claim was lost.");
			}
		}
		await input.transaction.approval.updateMany({
			where: { changeSetId: input.changeSet.id, invalidatedAt: null },
			data: { invalidatedAt: timestamp },
		});
		if (input.changeSet.status !== "conflicted") {
			const audit = auditEventSchema.parse({
				id: createId("audit_event"),
				version: 1,
				plane: "store_runtime",
				type: "change_set.conflicted",
				actor: input.actor,
				authority: input.authority,
				target: input.changeSet.target,
				occurredAt: timestamp.toISOString(),
				data: { changeSetId: input.changeSet.id },
			});
			await input.transaction.auditEvent.create({
				data: auditCreateData(audit),
			});
		}
		return {
			...input.changeSet,
			status: "conflicted",
			updatedAt: timestamp.toISOString(),
		};
	}

	function standingTarget(input: {
		businessId: string;
		storeId?: string | undefined;
	}): TargetReference {
		return input.storeId
			? { type: "store", id: input.storeId }
			: { type: "business", id: input.businessId };
	}

	function standingPermissionManagementPermission(
		storeId: string | undefined,
	): string {
		return storeId ? "team:update" : "organization:update";
	}

	async function assertClaimedScope(
		transaction: TTransaction,
		target: TargetReference,
		claimed: GrantTargetScope,
	): Promise<void> {
		const scope = await options.resolveTargetScope(transaction, target);
		if (
			!scope ||
			scope.businessId !== claimed.businessId ||
			scope.storeId !== claimed.storeId
		) {
			throw new Error("The claimed standing-permission scope is invalid.");
		}
	}

	return {
		createChangeSet: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = createChangeSetInputSchema.parse(rawInput);
				if (input.content.supersedesChangeSetId !== undefined) {
					throw new Error(
						"Change Set lineage may only be assigned by an authorized rebase.",
					);
				}
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: contentTargets(input.content),
					requiredPermissions: input.content.requiredPermissions,
					operation: "change_set.create",
				});
				return persistChangeSet(transaction, {
					content: input.content,
					...administrator,
				});
			}),

		approveChangeSet: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = approveChangeSetInputSchema.parse(rawInput);
				const changeSet = await lockChangeSet(transaction, input.changeSetId);
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: contentTargets(changeSet),
					requiredPermissions: changeSet.requiredPermissions,
					operation: "change_set.approve",
				});
				requireHumanOwner(input.principal, administrator);
				const currentBaseRevisions = z
					.array(baseRevisionSchema)
					.min(1)
					.max(250)
					.parse(
						await options.resolveCurrentBaseRevisions(transaction, changeSet),
					);
				if (
					canonicalRevisions(currentBaseRevisions) !==
						canonicalRevisions(changeSet.baseRevisions) &&
					["draft", "approved"].includes(changeSet.status)
				) {
					return {
						ok: false as const,
						reason: "conflicted" as const,
						changeSet: await conflictChangeSet({
							transaction,
							changeSet,
							...administrator,
						}),
					};
				}
				if (
					changeSet.status !== "draft" ||
					changeSet.immutableAt !== undefined ||
					changeSet.validationBlocks.length > 0 ||
					changeSet.reviewHash !== computeChangeSetReviewHash(changeSet)
				) {
					return { ok: false, reason: "invalid", changeSet } as const;
				}
				const timestamp = await databaseNow(transaction);
				const frozen = await transaction.changeSet.updateMany({
					where: {
						id: changeSet.id,
						status: "draft",
						reviewHash: changeSet.reviewHash,
						immutableAt: null,
					},
					data: {
						status: "approved",
						immutableAt: timestamp,
						updatedAt: timestamp,
					},
				});
				if (frozen.count !== 1) {
					throw new Error("The Change Set approval claim was lost.");
				}
				const approval = approvalSchema.parse({
					id: createId("approval"),
					changeSetId: changeSet.id,
					reviewHash: changeSet.reviewHash,
					baseRevisions: changeSet.baseRevisions,
					actor: administrator.actor,
					authority: administrator.authority,
					approvedAt: timestamp.toISOString(),
				});
				await transaction.approval.create({
					data: {
						id: approval.id,
						changeSetId: approval.changeSetId,
						reviewHash: approval.reviewHash,
						baseRevisions: approval.baseRevisions,
						actorType: approval.actor.type,
						actorId: approval.actor.id,
						actor: approval.actor,
						authorityType: approval.authority.type,
						authorityId: approval.authority.id,
						authority: approval.authority,
						approvedAt: timestamp,
					},
				});
				const audit = auditEventSchema.parse({
					id: createId("audit_event"),
					version: 1,
					plane: "store_runtime",
					type: "approval.created",
					...administrator,
					target: changeSet.target,
					occurredAt: timestamp.toISOString(),
					data: {
						approvalId: approval.id,
						changeSetId: changeSet.id,
						reviewHash: changeSet.reviewHash,
					},
				});
				await transaction.auditEvent.create({ data: auditCreateData(audit) });
				return {
					ok: true as const,
					approval,
					changeSet: {
						...changeSet,
						status: "approved" as const,
						immutableAt: timestamp.toISOString(),
						updatedAt: timestamp.toISOString(),
					},
				};
			}),

		rebaseChangeSet: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = rebaseChangeSetInputSchema.parse(rawInput);
				if (input.content.supersedesChangeSetId !== undefined) {
					throw new Error(
						"Change Set lineage may only be assigned by an authorized rebase.",
					);
				}
				const existing = await lockChangeSet(transaction, input.changeSetId);
				if (
					!["draft", "approved", "conflicted"].includes(existing.status) ||
					targetKey(existing.target) !== targetKey(input.content.target)
				) {
					throw new Error("The Change Set cannot be rebased.");
				}
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: uniqueTargets([
						...contentTargets(existing),
						...contentTargets(input.content),
					]),
					requiredPermissions: [
						...existing.requiredPermissions,
						...input.content.requiredPermissions,
					],
					operation: "change_set.rebase",
				});
				const currentBaseRevisions = z
					.array(baseRevisionSchema)
					.min(1)
					.max(250)
					.parse(
						await options.resolveCurrentBaseRevisions(
							transaction,
							input.content,
						),
					);
				if (
					canonicalRevisions(currentBaseRevisions) !==
					canonicalRevisions(input.content.baseRevisions)
				) {
					throw new Error(
						"The Change Set cannot be rebased against stale revisions.",
					);
				}
				await conflictChangeSet({
					transaction,
					changeSet: existing,
					...administrator,
				});
				return persistChangeSet(transaction, {
					content: input.content,
					...administrator,
					supersedesChangeSetId: existing.id,
				});
			}),

		createStandingPermission: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = standingPermissionInputSchema.parse(rawInput);
				const target = standingTarget(input);
				const requiredPermission = standingPermissionManagementPermission(
					input.storeId,
				);
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: [target],
					requiredPermissions: [requiredPermission],
					operation: "standing_permission.create",
				});
				requireHumanOwner(input.principal, administrator);
				await assertClaimedScope(transaction, target, {
					businessId: input.businessId,
					...(input.storeId ? { storeId: input.storeId } : {}),
				});
				const policy = admissionPolicySchema.safeParse(
					await options.resolveActionPolicy(transaction, input.action),
				);
				if (
					!policy.success ||
					policy.data.kind !== "confirmation" ||
					policy.data.standingPermission !== "allowed" ||
					policy.data.freshOnly
				) {
					throw new Error(
						"This Command cannot be covered by a standing permission.",
					);
				}
				const timestamp = await databaseNow(transaction);
				if (Date.parse(input.validUntil) <= timestamp.getTime()) {
					throw new Error("Standing permission must expire in the future.");
				}
				const permission = standingPermissionSchema.parse({
					id: createId("standing_permission"),
					grantee: input.grantee,
					grantor: administrator.actor,
					authority: administrator.authority,
					businessId: input.businessId,
					...(input.storeId ? { storeId: input.storeId } : {}),
					action: input.action,
					validFrom: input.validFrom,
					validUntil: input.validUntil,
					...(input.perOperationAmount === undefined
						? {}
						: {
								perOperationAmount: input.perOperationAmount,
								aggregateAmount: input.aggregateAmount,
								currency: input.currency,
							}),
					createdAt: timestamp.toISOString(),
				});
				await transaction.standingPermission.create({
					data: {
						id: permission.id,
						granteeType: permission.grantee.type,
						granteeId: permission.grantee.id,
						grantee: permission.grantee,
						grantorType: permission.grantor.type,
						grantorId: permission.grantor.id,
						grantor: permission.grantor,
						authorityType: permission.authority.type,
						authorityId: permission.authority.id,
						authority: permission.authority,
						businessId: permission.businessId,
						storeId: permission.storeId,
						actionName: permission.action.name,
						actionVersion: permission.action.version,
						validFrom: new Date(permission.validFrom),
						validUntil: new Date(permission.validUntil),
						perOperationAmount: permission.perOperationAmount,
						aggregateAmount: permission.aggregateAmount,
						currency: permission.currency,
						createdAt: timestamp,
						updatedAt: timestamp,
					},
				});
				const audit = auditEventSchema.parse({
					id: createId("audit_event"),
					version: 1,
					plane: "store_runtime",
					type: "standing_permission.created",
					...administrator,
					target,
					occurredAt: timestamp.toISOString(),
					data: {
						standingPermissionId: permission.id,
						grantee: permission.grantee,
						action: permission.action,
						validFrom: permission.validFrom,
						validUntil: permission.validUntil,
						...(permission.aggregateAmount === undefined ||
						permission.currency === undefined
							? {}
							: {
									aggregateAmount: permission.aggregateAmount,
									currency: permission.currency,
								}),
					},
				});
				await transaction.auditEvent.create({ data: auditCreateData(audit) });
				return permission;
			}),

		revokeStandingPermission: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = revokeStandingPermissionInputSchema.parse(rawInput);
				const target = standingTarget(input);
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: [target],
					requiredPermissions: [
						standingPermissionManagementPermission(input.storeId),
					],
					operation: "standing_permission.revoke",
				});
				requireHumanOwner(input.principal, administrator);
				await assertClaimedScope(transaction, target, input);
				const rows = await transaction.$queryRawUnsafe<
					Array<{
						id: string;
						businessId: string;
						storeId: string | null;
						revokedAt: Date | string | null;
					}>
				>(
					`SELECT "id", "businessId", "storeId", "revokedAt"
           FROM "StandingPermission"
           WHERE "id" = $1 AND "businessId" = $2
             AND "storeId" IS NOT DISTINCT FROM $3
           FOR UPDATE`,
					input.standingPermissionId,
					input.businessId,
					input.storeId ?? null,
				);
				const permission = rows[0];
				if (!permission) throw new Error("Standing permission not found.");
				if (permission.revokedAt !== null) return;
				const timestamp = await databaseNow(transaction);
				const revoked = await transaction.standingPermission.updateMany({
					where: { id: permission.id, revokedAt: null },
					data: { revokedAt: timestamp, updatedAt: timestamp },
				});
				if (revoked.count !== 1) return;
				const audit = auditEventSchema.parse({
					id: createId("audit_event"),
					version: 1,
					plane: "store_runtime",
					type: "standing_permission.revoked",
					...administrator,
					target,
					occurredAt: timestamp.toISOString(),
					data: { standingPermissionId: permission.id },
				});
				await transaction.auditEvent.create({ data: auditCreateData(audit) });
			}),

		resolveAmbiguousStandingReservation: (rawInput) =>
			client.$transaction(async (transaction) => {
				const input = resolveReservationInputSchema.parse(rawInput);
				const target = standingTarget(input);
				const administrator = await authorize(transaction, {
					principal: input.principal,
					targets: [target],
					requiredPermissions: [
						standingPermissionManagementPermission(input.storeId),
					],
					operation: "standing_permission.resolve_ambiguous",
				});
				requireHumanOwner(input.principal, administrator);
				await assertClaimedScope(transaction, target, input);
				const rows = await transaction.$queryRawUnsafe<
					Array<{
						reservationId: string;
						standingPermissionId: string;
						state: string;
						updatedAt: Date | string;
					}>
				>(
					`SELECT reservation."id" AS "reservationId",
                  reservation."standingPermissionId", reservation."state",
                  reservation."updatedAt"
           FROM "StandingPermissionUseReservation" reservation
           JOIN "StandingPermission" permission
             ON permission."id" = reservation."standingPermissionId"
           WHERE reservation."commandExecutionId" = $1
             AND permission."businessId" = $2
             AND permission."storeId" IS NOT DISTINCT FROM $3
           FOR UPDATE OF reservation, permission`,
					input.commandExecutionId,
					input.businessId,
					input.storeId ?? null,
				);
				const reservation = rows[0];
				if (!reservation) {
					throw new Error("Standing-permission reservation not found.");
				}
				const state = input.outcome === "succeeded" ? "committed" : "released";
				if (reservation.state === state) {
					return {
						reservationId: reservation.reservationId,
						state,
						resolvedAt: iso(reservation.updatedAt),
					};
				}
				if (reservation.state !== "ambiguous") {
					throw new Error("Only an ambiguous reservation may be reconciled.");
				}
				const timestamp = await databaseNow(transaction);
				const resolved =
					await transaction.standingPermissionUseReservation.updateMany({
						where: { id: reservation.reservationId, state: "ambiguous" },
						data: { state, updatedAt: timestamp },
					});
				if (resolved.count !== 1) {
					throw new Error("The reservation reconciliation claim was lost.");
				}
				const audit = auditEventSchema.parse({
					id: createId("audit_event"),
					version: 1,
					plane: "store_runtime",
					type: "standing_permission.reservation_resolved",
					...administrator,
					target,
					occurredAt: timestamp.toISOString(),
					data: {
						standingPermissionId: reservation.standingPermissionId,
						reservationId: reservation.reservationId,
						commandExecutionId: input.commandExecutionId,
						outcome: input.outcome,
						evidenceReference: input.evidenceReference,
					},
				});
				await transaction.auditEvent.create({ data: auditCreateData(audit) });
				return {
					reservationId: reservation.reservationId,
					state,
					resolvedAt: timestamp.toISOString(),
				};
			}),
	};
}
