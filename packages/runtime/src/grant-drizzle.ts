import { randomUUID } from "node:crypto";
import {
	type ActorReference,
	type AuthoritySnapshot,
	type CommandFailure,
	changeSetSchema,
	type TargetReference,
} from "@86d-app/core/commands";
import {
	type CommandGrantAdapter,
	type CommandGrantAdmissionRequest,
	computeChangeSetReviewHash,
	computeConfirmationNonceDigest,
	normalizeBaseRevisions,
} from "./grants";

export interface DrizzleCommandGrantTransaction {
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
	$executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface DrizzleCommandGrantAdapterOptions {
	nonceDigestKey: string;
	createReservationId?: (() => string) | undefined;
	createAuditId?: (() => string) | undefined;
}

interface ApprovalRow {
	id: string;
	changeSetId: string;
	reviewHash: string;
	baseRevisions: unknown;
	actor: unknown;
	authority: unknown;
	invalidatedAt: Date | null;
	alreadyUsed: boolean;
	changeSet: Record<string, unknown>;
}

interface StandingPermissionRow {
	id: string;
	perOperationAmount: unknown | null;
	aggregateAmount: unknown | null;
	currency: string | null;
	validFrom: Date | string;
	validUntil: Date | string;
	revokedAt: Date | string | null;
}

function denied(
	code: CommandFailure["code"],
	message: string,
): { ok: false; failure: CommandFailure } {
	return { ok: false, failure: { code, message, retryable: false } };
}

function sameTarget(left: TargetReference, right: TargetReference): boolean {
	return left.type === right.type && left.id === right.id;
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((entry) => `${JSON.stringify(entry)}:${canonical(record[entry])}`)
		.join(",")}}`;
}

function parseProof(
	value: string | undefined,
): { id: string; nonce: string } | undefined {
	if (!value) return undefined;
	const separator = value.indexOf(".");
	if (separator <= 0 || separator === value.length - 1) return undefined;
	const id = value.slice(0, separator);
	const nonce = value.slice(separator + 1);
	if (id.length > 255 || nonce.length < 32 || nonce.length > 512) {
		return undefined;
	}
	return { id, nonce };
}

function parseActor(value: unknown): ActorReference | undefined {
	if (!value || typeof value !== "object") return undefined;
	const actor = value as Record<string, unknown>;
	if (
		(actor.type !== "account" &&
			actor.type !== "workload" &&
			actor.type !== "system") ||
		typeof actor.id !== "string"
	) {
		return undefined;
	}
	return { type: actor.type, id: actor.id };
}

function iso(value: unknown): string | undefined {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return new Date(value).toISOString();
	return undefined;
}

function parseChangeSet(row: ApprovalRow) {
	const { supersedesChangeSetId, ...changeSet } = row.changeSet;
	return changeSetSchema.parse({
		...changeSet,
		...(typeof supersedesChangeSetId === "string"
			? { supersedesChangeSetId }
			: {}),
		createdAt: iso(row.changeSet.createdAt),
		updatedAt: iso(row.changeSet.updatedAt),
		...(row.changeSet.immutableAt
			? { immutableAt: iso(row.changeSet.immutableAt) }
			: {}),
	});
}

async function admitApproval<T extends DrizzleCommandGrantTransaction>(
	transaction: T,
	request: CommandGrantAdmissionRequest<T>,
) {
	if (!request.approvalReference) {
		return denied("approval_required", "This Command requires an approval.");
	}
	const rows = await transaction.$queryRawUnsafe<ApprovalRow[]>(
		`SELECT
		  a."id", a."changeSetId", a."reviewHash", a."baseRevisions",
		  a."actor", a."authority", a."invalidatedAt",
		  EXISTS (
		    SELECT 1 FROM "CommandExecution" used
		    WHERE used."approvalId" = a."id" AND used."id" <> $2
		  ) AS "alreadyUsed",
		  jsonb_build_object(
		    'id', c."id", 'version', c."version", 'changeSetHashVersion', c."changeSetHashVersion",
		    'ownerPlane', c."ownerPlane", 'status', c."status", 'reviewHash', c."reviewHash",
		    'target', c."target", 'proposal', c."proposal",
		    'supersedesChangeSetId', c."supersedesChangeSetId",
		    'baseRevisions', c."baseRevisions", 'affectedTargets', c."affectedTargets",
		    'beforeSummary', c."beforeSummary", 'afterSummary', c."afterSummary",
		    'publicEffects', c."publicEffects", 'operationalEffects', c."operationalEffects",
		    'estimatedCharges', c."estimatedCharges", 'requiredPermissions', c."requiredPermissions",
		    'validationBlocks', c."validationBlocks", 'rollbackCoverage', c."rollbackCoverage",
		    'createdAt', c."createdAt", 'updatedAt', c."updatedAt", 'immutableAt', c."immutableAt"
		  ) AS "changeSet"
		FROM "Approval" a
		JOIN "ChangeSet" c ON c."id" = a."changeSetId"
		WHERE a."id" = $1
		FOR UPDATE OF a, c`,
		request.approvalReference,
		request.executionId,
	);
	const row = rows[0];
	if (!row || row.invalidatedAt || row.alreadyUsed) {
		return denied(
			"approval_invalid",
			"The approval is invalid or already used.",
		);
	}
	const changeSet = parseChangeSet(row);
	const facts = await request.resolveFacts(transaction);
	const approvalActor = parseActor(row.actor);
	const approvalAuthority = row.authority as AuthoritySnapshot;
	const permissions = new Set(approvalAuthority.permissions ?? []);
	const currentBaseRevisionsMatch =
		facts.baseRevisions !== undefined &&
		canonical(normalizeBaseRevisions(facts.baseRevisions)) ===
			canonical(normalizeBaseRevisions(changeSet.baseRevisions));
	if (!currentBaseRevisionsMatch) {
		return {
			ok: false as const,
			failure: {
				code: "approval_invalid" as const,
				message: "The Change Set base revisions have changed.",
				retryable: false,
				details: {
					reason: "base_revision_conflict",
					changeSetId: changeSet.id,
					approvalId: row.id,
				},
			},
		};
	}
	const valid =
		facts.bindingHashVersion === 1 &&
		facts.baseRevisions !== undefined &&
		approvalActor?.type === request.actor.type &&
		approvalActor.id === request.actor.id &&
		canonical(approvalAuthority) === canonical(request.authority) &&
		changeSet.ownerPlane === request.plane &&
		changeSet.status === "approved" &&
		changeSet.immutableAt !== undefined &&
		changeSet.validationBlocks.length === 0 &&
		row.reviewHash === changeSet.reviewHash &&
		computeChangeSetReviewHash(changeSet) === changeSet.reviewHash &&
		Array.isArray(row.baseRevisions) &&
		canonical(normalizeBaseRevisions(row.baseRevisions)) ===
			canonical(normalizeBaseRevisions(changeSet.baseRevisions)) &&
		currentBaseRevisionsMatch &&
		changeSet.requiredPermissions.every((permission) =>
			permissions.has(permission),
		) &&
		changeSet.proposal.command.name === request.command.name &&
		changeSet.proposal.command.version === request.command.version &&
		sameTarget(changeSet.proposal.target, request.target) &&
		changeSet.proposal.inputDigest === request.inputDigest;
	if (!valid) {
		return denied(
			"approval_invalid",
			"The approval no longer matches the exact Change Set.",
		);
	}
	return {
		ok: true as const,
		grantUse: {
			kind: "approval" as const,
			approvalId: row.id,
			changeSetId: row.changeSetId,
			reviewHash: row.reviewHash,
		},
	};
}

async function admitConfirmation<T extends DrizzleCommandGrantTransaction>(
	transaction: T,
	request: CommandGrantAdmissionRequest<T>,
	proof: { id: string; nonce: string },
	nonceDigestKey: string,
) {
	if (
		request.principal.type !== "session" ||
		request.actor.type !== "account"
	) {
		return denied(
			"confirmation_invalid",
			"A human-present account session is required.",
		);
	}
	const facts = await request.resolveFacts(transaction);
	if (facts.bindingHashVersion !== 1) {
		return denied("confirmation_invalid", "The grant hash version is invalid.");
	}
	const values = [
		proof.id,
		computeConfirmationNonceDigest(nonceDigestKey, proof.nonce),
		request.actor.type,
		request.actor.id,
		request.principal.sessionId,
		request.target.type,
		request.target.id,
		request.command.name,
		request.command.version,
		facts.bindingHashVersion,
		facts.bindingHash,
		facts.disclosure,
		facts.amount ?? null,
		facts.currency ?? null,
	] as const;
	const locked = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
		`SELECT "id"
		 FROM "Confirmation"
		 WHERE "id" = $1
		   AND "nonceDigest" = $2
		   AND "actorType" = $3 AND "actorId" = $4
		   AND "sessionId" = $5
		   AND "targetType" = $6 AND "targetId" = $7
		   AND "commandName" = $8 AND "commandVersion" = $9
		   AND "bindingHashVersion" = $10 AND "bindingHash" = $11
		   AND "disclosure" = $12
		   AND "amount" IS NOT DISTINCT FROM $13::numeric
		   AND "currency" IS NOT DISTINCT FROM $14
		   AND "consumedAt" IS NULL
		 FOR UPDATE`,
		...values,
	);
	if (!locked[0]) {
		return denied(
			"confirmation_invalid",
			"The confirmation is invalid, expired, or already used.",
		);
	}
	const rows = await transaction.$queryRawUnsafe<
		Array<{ id: string; bindingHash: string }>
	>(
		`WITH decision AS MATERIALIZED (
		   SELECT clock_timestamp() AS "at"
		 )
		 UPDATE "Confirmation" confirmation
		 SET "consumedAt" = decision."at"
		 FROM decision
		 WHERE confirmation."id" = $1
		   AND confirmation."createdAt" <= decision."at"
		   AND confirmation."expiresAt" > decision."at"
		   AND confirmation."consumedAt" IS NULL
		 RETURNING confirmation."id", confirmation."bindingHash"`,
		proof.id,
	);
	const confirmation = rows[0];
	if (!confirmation) {
		return denied(
			"confirmation_invalid",
			"The confirmation is invalid, expired, or already used.",
		);
	}
	return {
		ok: true as const,
		grantUse: {
			kind: "confirmation" as const,
			confirmationId: confirmation.id,
			bindingHash: confirmation.bindingHash,
		},
	};
}

function authoritativeScope<T extends DrizzleCommandGrantTransaction>(
	request: CommandGrantAdmissionRequest<T>,
	businessId: string | undefined,
	storeId: string | undefined,
) {
	if (!businessId) return undefined;
	if (request.target.type === "business") {
		return businessId === request.target.id && storeId === undefined
			? { businessId, storeId: undefined, globalOnly: true }
			: undefined;
	}
	if (request.target.type === "store") {
		return storeId === request.target.id
			? { businessId, storeId, globalOnly: false }
			: undefined;
	}
	return { businessId, storeId, globalOnly: false };
}

async function admitStanding<T extends DrizzleCommandGrantTransaction>(
	transaction: T,
	request: CommandGrantAdmissionRequest<T>,
	createReservationId: () => string,
) {
	const facts = await request.resolveFacts(transaction);
	if (facts.bindingHashVersion !== 1) {
		return denied("confirmation_invalid", "The grant hash version is invalid.");
	}
	const scope = authoritativeScope(request, facts.businessId, facts.storeId);
	if (!scope) {
		return denied(
			"confirmation_required",
			"This Command requires a fresh confirmation.",
		);
	}
	const rows = await transaction.$queryRawUnsafe<StandingPermissionRow[]>(
		`SELECT "id", "perOperationAmount", "aggregateAmount", "currency",
		        "validFrom", "validUntil", "revokedAt"
		 FROM "StandingPermission"
		 WHERE "granteeType" = $1 AND "granteeId" = $2
		   AND "businessId" = $3
		   AND (($5 = TRUE AND "storeId" IS NULL)
		        OR ($5 = FALSE AND ("storeId" IS NULL OR "storeId" = $4)))
		   AND "actionName" = $6 AND "actionVersion" = $7
		   AND "validFrom" <= clock_timestamp()
		   AND "validUntil" > clock_timestamp()
		   AND "revokedAt" IS NULL
		 ORDER BY "id"
		 FOR UPDATE`,
		request.actor.type,
		request.actor.id,
		scope.businessId,
		scope.storeId ?? null,
		scope.globalOnly,
		request.command.name,
		request.command.version,
	);
	if (rows.length === 0) {
		return denied(
			"confirmation_required",
			"This Command requires a fresh confirmation.",
		);
	}
	const decisionRows = await transaction.$queryRawUnsafe<
		Array<{ now: Date | string }>
	>('SELECT clock_timestamp() AS "now"');
	const decisionValue = decisionRows[0]?.now;
	const decisionTime =
		decisionValue instanceof Date
			? decisionValue.getTime()
			: Date.parse(decisionValue ?? "");
	if (!Number.isFinite(decisionTime)) {
		throw new Error("The database did not return a valid grant decision time.");
	}
	let activePermissions = 0;
	for (const permission of rows) {
		const validFrom =
			permission.validFrom instanceof Date
				? permission.validFrom.getTime()
				: Date.parse(permission.validFrom);
		const validUntil =
			permission.validUntil instanceof Date
				? permission.validUntil.getTime()
				: Date.parse(permission.validUntil);
		if (
			permission.revokedAt !== null ||
			validFrom > decisionTime ||
			validUntil <= decisionTime
		) {
			continue;
		}
		activePermissions += 1;
		const perOperation =
			permission.perOperationAmount === null
				? undefined
				: BigInt(String(permission.perOperationAmount));
		const aggregate =
			permission.aggregateAmount === null
				? undefined
				: BigInt(String(permission.aggregateAmount));
		const amount =
			facts.amount === undefined ? undefined : BigInt(facts.amount);
		if (
			(perOperation === undefined) !== (amount === undefined) ||
			permission.currency !== (facts.currency ?? null) ||
			(perOperation !== undefined &&
				amount !== undefined &&
				amount > perOperation)
		) {
			continue;
		}
		if (amount !== undefined && aggregate !== undefined) {
			const totals = await transaction.$queryRawUnsafe<
				Array<{ total: unknown }>
			>(
				`SELECT COALESCE(SUM("amount"), 0) AS "total"
				 FROM "StandingPermissionUseReservation"
				 WHERE "standingPermissionId" = $1
				   AND "state" IN ('reserved', 'committed', 'ambiguous')`,
				permission.id,
			);
			if (BigInt(String(totals[0]?.total ?? 0)) + amount > aggregate) continue;
		}
		const reservationId = createReservationId();
		if (facts.amount !== undefined && facts.currency === undefined) continue;
		await transaction.$executeRawUnsafe(
			`INSERT INTO "StandingPermissionUseReservation"
			 ("id", "standingPermissionId", "commandExecutionId", "amount", "currency", "state", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4::numeric, $5, 'reserved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			reservationId,
			permission.id,
			request.executionId,
			facts.amount ?? null,
			facts.currency ?? null,
		);
		return {
			ok: true as const,
			grantUse: {
				kind: "standing_permission" as const,
				standingPermissionId: permission.id,
				reservationId,
				...(facts.amount === undefined
					? {}
					: { amount: facts.amount, currency: facts.currency }),
			},
		};
	}
	return denied(
		activePermissions === 0
			? "confirmation_required"
			: "standing_permission_exhausted",
		activePermissions === 0
			? "This Command requires a fresh confirmation."
			: "No matching standing permission has remaining authority.",
	);
}

/** Durable grant admission performed inside the Command claim transaction. */
export function createDrizzleCommandGrantAdapter<
	T extends DrizzleCommandGrantTransaction,
>(options: DrizzleCommandGrantAdapterOptions): CommandGrantAdapter<T> {
	if (new TextEncoder().encode(options.nonceDigestKey).byteLength < 32) {
		throw new Error("Confirmation nonce digest key must be at least 32 bytes.");
	}
	const createReservationId = options.createReservationId ?? randomUUID;
	const createAuditId = options.createAuditId ?? randomUUID;
	return {
		async admit(transaction, request) {
			if (request.policy.kind === "automatic") {
				const facts = await request.resolveFacts(transaction);
				return facts.bindingHashVersion === 1
					? { ok: true, grantUse: { kind: "automatic" } }
					: denied("invalid_request", "The grant hash version is invalid.");
			}
			if (request.policy.kind === "approval") {
				return admitApproval(transaction, request);
			}
			const proof = parseProof(request.confirmationReference);
			if (proof) {
				return admitConfirmation(
					transaction,
					request,
					proof,
					options.nonceDigestKey,
				);
			}
			if (
				request.confirmationReference ||
				request.policy.freshOnly ||
				request.policy.standingPermission === "forbidden"
			) {
				return denied(
					request.confirmationReference
						? "confirmation_invalid"
						: "confirmation_required",
					"This Command requires a fresh confirmation.",
				);
			}
			return admitStanding(transaction, request, createReservationId);
		},

		async revalidate(transaction, request, grantUse) {
			if (request.policy.kind !== "approval") {
				return { ok: true, grantUse };
			}
			const revalidated = await admitApproval(transaction, request);
			if (!revalidated.ok) return revalidated;
			return revalidated.grantUse.kind === "approval" &&
				revalidated.grantUse.approvalId ===
					(grantUse.kind === "approval" ? grantUse.approvalId : undefined)
				? revalidated
				: denied(
						"approval_invalid",
						"The approval no longer matches the exact Change Set.",
					);
		},

		async settle(transaction, executionId, outcome) {
			await transaction.$executeRawUnsafe(
				`UPDATE "StandingPermissionUseReservation"
				 SET "state" = $2, "updatedAt" = CURRENT_TIMESTAMP
				 WHERE "commandExecutionId" = $1
				   AND "state" IN ('reserved', 'ambiguous')`,
				executionId,
				outcome === "succeeded" ? "committed" : "released",
			);
			await transaction.$executeRawUnsafe(
				`UPDATE "ChangeSet"
				 SET "status" = $2, "updatedAt" = CURRENT_TIMESTAMP
				 WHERE "id" = (
				   SELECT a."changeSetId"
				   FROM "CommandExecution" e JOIN "Approval" a ON a."id" = e."approvalId"
				   WHERE e."id" = $1
				 ) AND "status" = 'approved'`,
				executionId,
				outcome === "succeeded" ? "applied" : "failed",
			);
		},

		async markAmbiguous(transaction, executionId) {
			await transaction.$executeRawUnsafe(
				`UPDATE "StandingPermissionUseReservation"
				 SET "state" = 'ambiguous', "updatedAt" = CURRENT_TIMESTAMP
				 WHERE "commandExecutionId" = $1 AND "state" = 'reserved'`,
				executionId,
			);
		},

		async recordDenied(transaction, request, failure) {
			const details = failure.details;
			if (
				failure.code !== "approval_invalid" ||
				!details ||
				Array.isArray(details) ||
				typeof details !== "object" ||
				details.reason !== "base_revision_conflict" ||
				typeof details.changeSetId !== "string" ||
				typeof details.approvalId !== "string"
			) {
				return;
			}
			await transaction.$executeRawUnsafe(
				`WITH conflicted AS (
				  UPDATE "ChangeSet"
				  SET "status" = 'conflicted', "updatedAt" = clock_timestamp()
				  WHERE "id" = $1 AND "status" = 'approved'
				  RETURNING "id"
				), invalidated AS (
				  UPDATE "Approval"
				  SET "invalidatedAt" = clock_timestamp()
				  WHERE "changeSetId" IN (SELECT "id" FROM conflicted)
				    AND "invalidatedAt" IS NULL
				  RETURNING "id"
				)
				INSERT INTO "AuditEvent" (
				  "id", "version", "plane", "eventType",
				  "actorType", "actorId", "actor",
				  "authorityType", "authorityId", "authority",
				  "targetType", "targetId", "target",
				  "commandName", "commandVersion", "occurredAt", "data"
				)
				SELECT
				  $2, 1, $3, 'change_set.conflicted',
				  $4, $5, $6::jsonb,
				  $7, $8, $9::jsonb,
				  $10, $11, $12::jsonb,
				  $13, $14, clock_timestamp(),
				  jsonb_build_object(
				    'changeSetId', $1::text,
				    'approvalId', $15::text,
				    'reason', 'base_revision_conflict'
				  )
				FROM conflicted`,
				details.changeSetId,
				createAuditId(),
				request.plane,
				request.actor.type,
				request.actor.id,
				JSON.stringify(request.actor),
				request.authority.type,
				request.authority.id,
				JSON.stringify(request.authority),
				request.target.type,
				request.target.id,
				JSON.stringify(request.target),
				request.command.name,
				request.command.version,
				details.approvalId,
			);
		},
	};
}
