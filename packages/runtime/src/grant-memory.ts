import { randomUUID, timingSafeEqual } from "node:crypto";
import {
	type Approval,
	approvalSchema,
	type ChangeSet,
	type CommandFailure,
	type Confirmation,
	changeSetSchema,
	confirmationSchema,
	type StandingPermission,
	type StandingPermissionUseReservation,
	standingPermissionSchema,
	standingPermissionUseReservationSchema,
	type TargetReference,
} from "@86d-app/core/commands";
import type { MemoryCommandTransaction } from "./command";
import {
	type CommandGrantAdapter,
	type CommandGrantAdmissionRequest,
	computeChangeSetReviewHash,
	computeConfirmationNonceDigest,
	normalizeBaseRevisions,
} from "./grants";

const INITIALIZED_KEY = "command:grants:initialized";

export interface InMemoryCommandGrantSeed {
	changeSets?: readonly ChangeSet[] | undefined;
	approvals?: readonly Approval[] | undefined;
	confirmations?: readonly Confirmation[] | undefined;
	standingPermissions?: readonly StandingPermission[] | undefined;
	reservations?: readonly StandingPermissionUseReservation[] | undefined;
}

export interface InMemoryCommandGrantAdapterOptions {
	seed?: InMemoryCommandGrantSeed | undefined;
	nonceDigestKey: string;
	clock?: (() => Date) | undefined;
	createReservationId?: (() => string) | undefined;
}

function denied(
	code: CommandFailure["code"],
	message: string,
): { ok: false; failure: CommandFailure } {
	return { ok: false, failure: { code, message, retryable: false } };
}

function approvalConflictFailure(
	changeSetId: string,
	approvalId: string,
): { ok: false; failure: CommandFailure } {
	return {
		ok: false,
		failure: {
			code: "approval_invalid",
			message: "The Change Set base revisions have changed.",
			retryable: false,
			details: {
				reason: "base_revision_conflict",
				changeSetId,
				approvalId,
			},
		},
	};
}

function approvalConflictDetails(failure: CommandFailure) {
	if (
		failure.code !== "approval_invalid" ||
		!failure.details ||
		Array.isArray(failure.details) ||
		typeof failure.details !== "object" ||
		failure.details.reason !== "base_revision_conflict" ||
		typeof failure.details.changeSetId !== "string" ||
		typeof failure.details.approvalId !== "string"
	) {
		return undefined;
	}
	return {
		changeSetId: failure.details.changeSetId,
		approvalId: failure.details.approvalId,
	};
}

function key(kind: string, id: string): string {
	return `command:grants:${kind}:${id}`;
}

function read<T>(
	transaction: MemoryCommandTransaction,
	kind: string,
	id: string,
): T | undefined {
	const value = transaction.get(key(kind, id));
	return value === null ? undefined : (JSON.parse(value) as T);
}

function write(
	transaction: MemoryCommandTransaction,
	kind: string,
	id: string,
	value: unknown,
): void {
	transaction.set(key(kind, id), JSON.stringify(value));
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

function sameTarget(left: TargetReference, right: TargetReference): boolean {
	return left.type === right.type && left.id === right.id;
}

function sameCommand(
	left: { name: string; version: number },
	right: { name: string; version: number },
): boolean {
	return left.name === right.name && left.version === right.version;
}

function equalDigest(left: string, right: string): boolean {
	if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
		return false;
	}
	return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function parseConfirmationProof(
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

function seedTransaction(
	transaction: MemoryCommandTransaction,
	seed: InMemoryCommandGrantSeed,
): void {
	if (transaction.get(INITIALIZED_KEY) !== null) return;
	for (const changeSet of seed.changeSets ?? []) {
		const parsed = changeSetSchema.parse(changeSet);
		write(transaction, "change-set", parsed.id, parsed);
	}
	for (const approval of seed.approvals ?? []) {
		const parsed = approvalSchema.parse(approval);
		write(transaction, "approval", parsed.id, parsed);
	}
	for (const confirmation of seed.confirmations ?? []) {
		const parsed = confirmationSchema.parse(confirmation);
		write(transaction, "confirmation", parsed.id, parsed);
	}
	for (const permission of seed.standingPermissions ?? []) {
		const parsed = standingPermissionSchema.parse(permission);
		write(transaction, "standing", parsed.id, parsed);
	}
	for (const reservation of seed.reservations ?? []) {
		const parsed = standingPermissionUseReservationSchema.parse(reservation);
		write(transaction, "reservation", parsed.id, parsed);
		write(
			transaction,
			"execution-reservation",
			parsed.commandExecutionId,
			parsed.id,
		);
	}
	write(
		transaction,
		"reservation-list",
		"all",
		(seed.reservations ?? []).map((reservation) => reservation.id),
	);
	transaction.set(INITIALIZED_KEY, "1");
}

async function admitApproval(
	transaction: MemoryCommandTransaction,
	request: CommandGrantAdmissionRequest<MemoryCommandTransaction>,
) {
	if (!request.approvalReference) {
		return denied("approval_required", "This Command requires an approval.");
	}
	const approval = read<Approval>(
		transaction,
		"approval",
		request.approvalReference,
	);
	const changeSet = approval
		? read<ChangeSet>(transaction, "change-set", approval.changeSetId)
		: undefined;
	if (!approval || !changeSet || approval.invalidatedAt) {
		return denied("approval_invalid", "The approval is invalid.");
	}
	const facts = await request.resolveFacts(transaction);
	const permissions = new Set(approval.authority.permissions);
	const exactReviewHash = computeChangeSetReviewHash(changeSet);
	const currentBaseRevisionsMatch =
		facts.baseRevisions !== undefined &&
		canonical(normalizeBaseRevisions(facts.baseRevisions)) ===
			canonical(normalizeBaseRevisions(changeSet.baseRevisions));
	if (!currentBaseRevisionsMatch) {
		return approvalConflictFailure(changeSet.id, approval.id);
	}
	const valid =
		facts.bindingHashVersion === 1 &&
		facts.baseRevisions !== undefined &&
		approval.actor.type === request.actor.type &&
		approval.actor.id === request.actor.id &&
		canonical(approval.authority) === canonical(request.authority) &&
		changeSet.ownerPlane === request.plane &&
		changeSet.status === "approved" &&
		changeSet.immutableAt !== undefined &&
		changeSet.validationBlocks.length === 0 &&
		approval.reviewHash === changeSet.reviewHash &&
		equalDigest(exactReviewHash, changeSet.reviewHash) &&
		canonical(normalizeBaseRevisions(approval.baseRevisions)) ===
			canonical(normalizeBaseRevisions(changeSet.baseRevisions)) &&
		currentBaseRevisionsMatch &&
		changeSet.requiredPermissions.every((permission) =>
			permissions.has(permission),
		) &&
		sameCommand(changeSet.proposal.command, request.command) &&
		sameTarget(changeSet.proposal.target, request.target) &&
		equalDigest(changeSet.proposal.inputDigest, request.inputDigest);
	if (!valid) {
		return denied(
			"approval_invalid",
			"The approval no longer matches the exact Change Set.",
		);
	}
	if (transaction.get(key("approval-use", approval.id)) !== null) {
		return denied("approval_invalid", "The approval was already used.");
	}
	transaction.set(key("approval-use", approval.id), request.executionId);
	write(transaction, "execution-change-set", request.executionId, changeSet.id);
	return {
		ok: true as const,
		grantUse: {
			kind: "approval" as const,
			approvalId: approval.id,
			changeSetId: changeSet.id,
			reviewHash: approval.reviewHash,
		},
	};
}

async function admitFreshConfirmation(
	transaction: MemoryCommandTransaction,
	request: CommandGrantAdmissionRequest<MemoryCommandTransaction>,
	proof: { id: string; nonce: string },
	nonceDigestKey: string,
	now: Date,
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
	const confirmation = read<Confirmation>(
		transaction,
		"confirmation",
		proof.id,
	);
	if (!confirmation) {
		return denied("confirmation_invalid", "The confirmation is invalid.");
	}
	const facts = await request.resolveFacts(transaction);
	const nonceDigest = computeConfirmationNonceDigest(
		nonceDigestKey,
		proof.nonce,
	);
	const valid =
		facts.bindingHashVersion === 1 &&
		confirmation.consumedAt === undefined &&
		Date.parse(confirmation.expiresAt) > now.getTime() &&
		confirmation.actor.type === request.actor.type &&
		confirmation.actor.id === request.actor.id &&
		confirmation.sessionId === request.principal.sessionId &&
		sameTarget(confirmation.target, request.target) &&
		sameCommand(confirmation.command, request.command) &&
		confirmation.bindingHashVersion === 1 &&
		equalDigest(confirmation.bindingHash, facts.bindingHash) &&
		equalDigest(confirmation.nonceDigest, nonceDigest) &&
		confirmation.disclosure === facts.disclosure &&
		confirmation.amount === facts.amount &&
		confirmation.currency === facts.currency;
	if (!valid) {
		return denied(
			"confirmation_invalid",
			"The confirmation is invalid, expired, or already used.",
		);
	}
	write(transaction, "confirmation", confirmation.id, {
		...confirmation,
		consumedAt: now.toISOString(),
	});
	return {
		ok: true as const,
		grantUse: {
			kind: "confirmation" as const,
			confirmationId: confirmation.id,
			bindingHash: confirmation.bindingHash,
		},
	};
}

function standingScopeMatches(
	permission: StandingPermission,
	request: CommandGrantAdmissionRequest<MemoryCommandTransaction>,
	businessId: string,
	storeId: string | undefined,
): boolean {
	if (request.target.type === "business") {
		return (
			businessId === request.target.id &&
			storeId === undefined &&
			permission.businessId === request.target.id &&
			permission.storeId === undefined
		);
	}
	if (request.target.type === "store") {
		return (
			storeId === request.target.id &&
			permission.businessId === businessId &&
			(permission.storeId === undefined ||
				permission.storeId === request.target.id)
		);
	}
	return permission.businessId === businessId && permission.storeId === storeId;
}

async function admitStandingPermission(
	transaction: MemoryCommandTransaction,
	request: CommandGrantAdmissionRequest<MemoryCommandTransaction>,
	permissions: readonly StandingPermission[],
	now: Date,
	createReservationId: () => string,
) {
	const facts = await request.resolveFacts(transaction);
	if (facts.bindingHashVersion !== 1) {
		return denied("confirmation_invalid", "The grant hash version is invalid.");
	}
	if (!facts.businessId) {
		return denied(
			"confirmation_required",
			"This Command requires a fresh confirmation.",
		);
	}
	const businessId = facts.businessId;
	const matching = permissions
		.filter(
			(permission) =>
				permission.grantee.type === request.actor.type &&
				permission.grantee.id === request.actor.id &&
				sameCommand(permission.action, request.command) &&
				Date.parse(permission.validFrom) <= now.getTime() &&
				Date.parse(permission.validUntil) > now.getTime() &&
				permission.revokedAt === undefined &&
				standingScopeMatches(permission, request, businessId, facts.storeId),
		)
		.sort((left, right) =>
			left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
		);
	for (const permission of matching) {
		const financial = permission.perOperationAmount !== undefined;
		if (
			financial !== (facts.amount !== undefined) ||
			permission.currency !== facts.currency
		) {
			continue;
		}
		const amount =
			facts.amount === undefined ? undefined : BigInt(facts.amount);
		const perOperationAmount = permission.perOperationAmount;
		const aggregateAmount = permission.aggregateAmount;
		if (
			amount !== undefined &&
			(perOperationAmount === undefined || amount > BigInt(perOperationAmount))
		) {
			continue;
		}
		let held = 0n;
		for (const reservation of readReservationList(transaction)) {
			if (
				reservation.standingPermissionId === permission.id &&
				reservation.state !== "released" &&
				reservation.amount !== undefined
			) {
				held += BigInt(reservation.amount);
			}
		}
		if (
			amount !== undefined &&
			(aggregateAmount === undefined || held + amount > BigInt(aggregateAmount))
		) {
			continue;
		}
		if (facts.amount !== undefined && facts.currency === undefined) continue;
		const id = createReservationId();
		const reservation: StandingPermissionUseReservation = {
			id,
			standingPermissionId: permission.id,
			commandExecutionId: request.executionId,
			...(facts.amount === undefined
				? {}
				: { amount: facts.amount, currency: facts.currency }),
			state: "reserved",
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		};
		write(transaction, "reservation", id, reservation);
		write(transaction, "execution-reservation", request.executionId, id);
		const ids = read<string[]>(transaction, "reservation-list", "all") ?? [];
		write(transaction, "reservation-list", "all", [...ids, id]);
		return {
			ok: true as const,
			grantUse: {
				kind: "standing_permission" as const,
				standingPermissionId: permission.id,
				reservationId: id,
				...(facts.amount === undefined
					? {}
					: { amount: facts.amount, currency: facts.currency }),
			},
		};
	}
	return denied(
		matching.length === 0
			? "confirmation_required"
			: "standing_permission_exhausted",
		matching.length === 0
			? "This Command requires a fresh confirmation."
			: "No matching standing permission has remaining authority.",
	);
}

function readReservationList(
	transaction: MemoryCommandTransaction,
): StandingPermissionUseReservation[] {
	const ids = read<string[]>(transaction, "reservation-list", "all") ?? [];
	return ids.flatMap((id) => {
		const reservation = read<StandingPermissionUseReservation>(
			transaction,
			"reservation",
			id,
		);
		return reservation ? [reservation] : [];
	});
}

function transitionReservation(
	transaction: MemoryCommandTransaction,
	executionId: string,
	state: "committed" | "released" | "ambiguous",
	now: Date,
): void {
	const reservationId = read<string>(
		transaction,
		"execution-reservation",
		executionId,
	);
	if (!reservationId) return;
	const reservation = read<StandingPermissionUseReservation>(
		transaction,
		"reservation",
		reservationId,
	);
	if (reservation?.state !== "reserved" && reservation?.state !== "ambiguous")
		return;
	write(transaction, "reservation", reservation.id, {
		...reservation,
		state,
		updatedAt: now.toISOString(),
	});
}

/** Transactional plane-local grant store used by Store Runtime conformance tests. */
export function createInMemoryCommandGrantAdapter(
	options: InMemoryCommandGrantAdapterOptions,
): CommandGrantAdapter<MemoryCommandTransaction> {
	if (new TextEncoder().encode(options.nonceDigestKey).byteLength < 32) {
		throw new Error("Confirmation nonce digest key must be at least 32 bytes.");
	}
	const clock = options.clock ?? (() => new Date());
	const createReservationId = options.createReservationId ?? randomUUID;
	const seed = options.seed ?? {};
	const permissions = (seed.standingPermissions ?? []).map((permission) =>
		standingPermissionSchema.parse(permission),
	);
	return {
		async admit(transaction, request) {
			seedTransaction(transaction, seed);
			if (request.policy.kind === "automatic") {
				const facts = await request.resolveFacts(transaction);
				if (facts.bindingHashVersion !== 1) {
					return denied(
						"invalid_request",
						"The grant hash version is invalid.",
					);
				}
				return { ok: true, grantUse: { kind: "automatic" } };
			}
			if (request.policy.kind === "approval") {
				return admitApproval(transaction, request);
			}
			const proof = parseConfirmationProof(request.confirmationReference);
			if (proof) {
				return admitFreshConfirmation(
					transaction,
					request,
					proof,
					options.nonceDigestKey,
					clock(),
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
			return admitStandingPermission(
				transaction,
				request,
				permissions,
				clock(),
				createReservationId,
			);
		},

		async settle(transaction, executionId, outcome) {
			const now = clock();
			transitionReservation(
				transaction,
				executionId,
				outcome === "succeeded" ? "committed" : "released",
				now,
			);
			const changeSetId = read<string>(
				transaction,
				"execution-change-set",
				executionId,
			);
			if (!changeSetId) return;
			const changeSet = read<ChangeSet>(transaction, "change-set", changeSetId);
			if (changeSet?.status === "approved") {
				write(transaction, "change-set", changeSet.id, {
					...changeSet,
					status: outcome === "succeeded" ? "applied" : "failed",
					updatedAt: now.toISOString(),
				});
			}
		},

		async markAmbiguous(transaction, executionId) {
			transitionReservation(transaction, executionId, "ambiguous", clock());
		},

		async recordDenied(transaction, _request, failure) {
			const conflict = approvalConflictDetails(failure);
			if (!conflict) return;
			const changeSet = read<ChangeSet>(
				transaction,
				"change-set",
				conflict.changeSetId,
			);
			const approval = read<Approval>(
				transaction,
				"approval",
				conflict.approvalId,
			);
			const invalidatedAt = clock().toISOString();
			if (changeSet?.status === "approved") {
				write(transaction, "change-set", changeSet.id, {
					...changeSet,
					status: "conflicted",
					updatedAt: invalidatedAt,
				});
			}
			if (approval && approval.invalidatedAt === undefined) {
				write(transaction, "approval", approval.id, {
					...approval,
					invalidatedAt,
				});
			}
		},
	};
}
