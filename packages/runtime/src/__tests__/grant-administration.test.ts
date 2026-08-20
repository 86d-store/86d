import { describe, expect, it, vi } from "vitest";
import { createPrismaStoreGrantAdministration } from "../grant-administration";

const databaseNow = new Date("2026-08-11T20:00:00.000Z");
const principal = {
	type: "session" as const,
	credentialId: "session-credential-1",
	sessionId: "session-1",
};
const actor = { type: "account" as const, id: "account-1" };
const authority = {
	id: "membership-1",
	type: "business_membership" as const,
	role: "owner",
	permissions: ["store:update", "organization:update", "team:update"],
	businessId: "business-1",
};
const target = { type: "store" as const, id: "store-1" };
const content = {
	changeSetHashVersion: 1,
	ownerPlane: "store_runtime" as const,
	target,
	proposal: {
		command: { name: "store_runtime.settings.publish", version: 1 },
		target,
		inputDigest: "a".repeat(64),
	},
	baseRevisions: [{ target, revision: "revision-1" }],
	affectedTargets: [target],
	beforeSummary: { enabled: false },
	afterSummary: { enabled: true },
	publicEffects: ["Store settings become visible."],
	operationalEffects: [],
	estimatedCharges: [],
	requiredPermissions: ["store:update"],
	validationBlocks: [],
	rollbackCoverage: "database" as const,
};

function harness(options?: {
	currentBaseRevisions?: typeof content.baseRevisions;
	rawQuery?: (query: string, values: readonly unknown[]) => unknown;
	authorized?: boolean;
	idPrefix?: string;
	policy?: {
		kind: "confirmation";
		standingPermission: "allowed" | "forbidden";
		freshOnly: boolean;
	} | null;
}) {
	const queryRawUnsafe = vi.fn();
	const transaction = {
		changeSet: {
			create: vi.fn(
				async ({ data }: { data: Record<string, unknown> }) => data,
			),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		approval: {
			create: vi.fn(
				async ({ data }: { data: Record<string, unknown> }) => data,
			),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		standingPermission: {
			create: vi.fn(
				async ({ data }: { data: Record<string, unknown> }) => data,
			),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		standingPermissionUseReservation: {
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		auditEvent: { create: vi.fn(async () => undefined) },
		async $queryRawUnsafe<T>(query: string, ...values: unknown[]) {
			queryRawUnsafe(query, ...values);
			if (query.includes("clock_timestamp()")) {
				return [{ now: databaseNow }] as T;
			}
			return (options?.rawQuery?.(query, values) ?? []) as T;
		},
	};
	const transactionCalls = vi.fn();
	const client = {
		async $transaction<T>(run: (value: typeof transaction) => Promise<T>) {
			transactionCalls();
			return run(transaction);
		},
	};
	const authorize = vi.fn(async () =>
		options?.authorized === false ? null : { actor, authority },
	);
	const resolveTargetScope = vi.fn(
		async (_transaction: typeof transaction, requestedTarget: typeof target) =>
			requestedTarget.type === "store"
				? { businessId: "business-1", storeId: requestedTarget.id }
				: null,
	);
	const resolveCurrentBaseRevisions = vi.fn(
		async () => options?.currentBaseRevisions ?? content.baseRevisions,
	);
	const resolveActionPolicy = vi.fn(
		async () =>
			options?.policy ?? {
				kind: "confirmation" as const,
				standingPermission: "allowed" as const,
				freshOnly: false,
			},
	);
	let id = 0;
	const administration = createPrismaStoreGrantAdministration(client, {
		createId: (kind) => `${options?.idPrefix ?? ""}${kind}-${++id}`,
		authorize,
		resolveTargetScope,
		resolveCurrentBaseRevisions,
		resolveActionPolicy,
	});
	return {
		administration,
		authorize,
		queryRawUnsafe,
		resolveActionPolicy,
		resolveCurrentBaseRevisions,
		resolveTargetScope,
		transaction,
		transactionCalls,
	};
}

describe("Store Runtime grant administration", () => {
	it("creates a strict review-hashed Change Set and immutable audit atomically", async () => {
		const { administration, queryRawUnsafe, transaction, transactionCalls } =
			harness();

		const changeSet = await administration.createChangeSet({
			principal,
			content,
		});

		expect(transactionCalls).toHaveBeenCalledTimes(1);
		expect(queryRawUnsafe).toHaveBeenCalledWith(
			expect.stringContaining("clock_timestamp()"),
		);
		expect(changeSet).toMatchObject({
			id: "change_set-1",
			ownerPlane: "store_runtime",
			status: "draft",
			createdAt: databaseNow.toISOString(),
			reviewHash: expect.stringMatching(/^[a-f0-9]{64}$/),
		});
		expect(transaction.changeSet.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				targetType: "store",
				targetId: target.id,
				proposal: content.proposal,
			}),
		});
		expect(transaction.auditEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				plane: "store_runtime",
				eventType: "change_set.created",
				occurredAt: databaseNow,
			}),
		});
	});

	it("locks and freezes only an exact current Change Set for its Store owner", async () => {
		const created = await harness().administration.createChangeSet({
			principal,
			content,
		});
		const lockedRow = {
			...created,
			createdAt: new Date(created.createdAt),
			updatedAt: new Date(created.updatedAt),
			immutableAt: null,
		};
		const { administration, queryRawUnsafe, transaction } = harness({
			rawQuery: (query) =>
				query.includes('FROM "ChangeSet"') ? [{ changeSet: lockedRow }] : [],
		});

		const result = await administration.approveChangeSet({
			principal,
			changeSetId: created.id,
		});

		expect(result).toMatchObject({
			ok: true,
			approval: {
				id: "approval-1",
				actor,
				authority,
				reviewHash: created.reviewHash,
			},
			changeSet: { status: "approved", immutableAt: databaseNow.toISOString() },
		});
		expect(queryRawUnsafe).toHaveBeenCalledWith(
			expect.stringContaining("FOR UPDATE"),
			created.id,
		);
		expect(transaction.changeSet.updateMany).toHaveBeenCalledWith({
			where: {
				id: created.id,
				status: "draft",
				reviewHash: created.reviewHash,
				immutableAt: null,
			},
			data: {
				status: "approved",
				immutableAt: databaseNow,
				updatedAt: databaseNow,
			},
		});
	});

	it("conflicts stale review content and invalidates every approval atomically", async () => {
		const created = await harness().administration.createChangeSet({
			principal,
			content,
		});
		const { administration, transaction } = harness({
			currentBaseRevisions: [{ target, revision: "revision-2" }],
			rawQuery: (query) =>
				query.includes('FROM "ChangeSet"')
					? [
							{
								changeSet: {
									...created,
									createdAt: new Date(created.createdAt),
									updatedAt: new Date(created.updatedAt),
									immutableAt: null,
								},
							},
						]
					: [],
		});

		const result = await administration.approveChangeSet({
			principal,
			changeSetId: created.id,
		});

		expect(result).toMatchObject({ ok: false, reason: "conflicted" });
		expect(transaction.changeSet.updateMany).toHaveBeenCalledWith({
			where: { id: created.id, status: "draft" },
			data: { status: "conflicted", updatedAt: databaseNow },
		});
		expect(transaction.approval.updateMany).toHaveBeenCalledWith({
			where: { changeSetId: created.id, invalidatedAt: null },
			data: { invalidatedAt: databaseNow },
		});
		expect(transaction.approval.create).not.toHaveBeenCalled();
	});

	it("rebases a conflicted Change Set against current revisions with server-owned lineage", async () => {
		const created = await harness().administration.createChangeSet({
			principal,
			content,
		});
		const replacement = {
			...content,
			baseRevisions: [{ target, revision: "revision-2" }],
		};
		const { administration, transaction } = harness({
			currentBaseRevisions: replacement.baseRevisions,
			idPrefix: "rebased-",
			rawQuery: (query) =>
				query.includes('FROM "ChangeSet"')
					? [
							{
								changeSet: {
									...created,
									status: "conflicted",
									createdAt: new Date(created.createdAt),
									updatedAt: new Date(created.updatedAt),
									immutableAt: null,
								},
							},
						]
					: [],
		});

		const rebased = await administration.rebaseChangeSet({
			principal,
			changeSetId: created.id,
			content: replacement,
		});

		expect(rebased).toMatchObject({
			status: "draft",
			supersedesChangeSetId: created.id,
			baseRevisions: replacement.baseRevisions,
		});
		expect(rebased.reviewHash).not.toBe(created.reviewHash);
		expect(transaction.changeSet.updateMany).not.toHaveBeenCalled();
		expect(transaction.approval.updateMany).toHaveBeenCalledWith({
			where: { changeSetId: created.id, invalidatedAt: null },
			data: { invalidatedAt: databaseNow },
		});
	});

	it("creates and revokes only owner-authorized, standing-eligible permissions", async () => {
		const createdHarness = harness();
		const permission =
			await createdHarness.administration.createStandingPermission({
				principal,
				grantee: { type: "workload", id: "workload-1" },
				businessId: "business-1",
				storeId: target.id,
				action: { name: "store_runtime.shipping.label_purchase", version: 1 },
				validFrom: databaseNow.toISOString(),
				validUntil: "2026-08-12T20:00:00.000Z",
				perOperationAmount: "25",
				aggregateAmount: "100",
				currency: "USD",
			});

		expect(permission).toMatchObject({
			id: "standing_permission-1",
			grantor: actor,
			grantee: { type: "workload", id: "workload-1" },
			createdAt: databaseNow.toISOString(),
		});
		expect(createdHarness.resolveActionPolicy).toHaveBeenCalledWith(
			createdHarness.transaction,
			permission.action,
		);

		const revokedHarness = harness({
			rawQuery: (query) =>
				query.includes('FROM "StandingPermission"')
					? [
							{
								id: permission.id,
								businessId: "business-1",
								storeId: target.id,
								revokedAt: null,
							},
						]
					: [],
		});
		await revokedHarness.administration.revokeStandingPermission({
			principal,
			standingPermissionId: permission.id,
			businessId: "business-1",
			storeId: target.id,
		});
		expect(
			revokedHarness.transaction.standingPermission.updateMany,
		).toHaveBeenCalledWith({
			where: { id: permission.id, revokedAt: null },
			data: { revokedAt: databaseNow, updatedAt: databaseNow },
		});

		const forbiddenHarness = harness({
			policy: {
				kind: "confirmation",
				standingPermission: "forbidden",
				freshOnly: true,
			},
		});
		await expect(
			forbiddenHarness.administration.createStandingPermission({
				principal,
				grantee: { type: "workload", id: "workload-1" },
				businessId: "business-1",
				storeId: target.id,
				action: { name: "store_runtime.account.destroy", version: 1 },
				validFrom: databaseNow.toISOString(),
				validUntil: "2026-08-12T20:00:00.000Z",
			}),
		).rejects.toThrow("cannot be covered");
		expect(
			forbiddenHarness.transaction.standingPermission.create,
		).not.toHaveBeenCalled();
	});

	it("authoritatively resolves an ambiguous reservation once with audit evidence", async () => {
		const { administration, queryRawUnsafe, transaction } = harness({
			rawQuery: (query) =>
				query.includes('FROM "StandingPermissionUseReservation"')
					? [
							{
								reservationId: "reservation-1",
								standingPermissionId: "standing-1",
								state: "ambiguous",
								updatedAt: databaseNow,
							},
						]
					: [],
		});

		const result = await administration.resolveAmbiguousStandingReservation({
			principal,
			commandExecutionId: "execution-1",
			businessId: "business-1",
			storeId: target.id,
			outcome: "succeeded",
			evidenceReference: "provider-operation-1",
		});

		expect(result).toEqual({
			reservationId: "reservation-1",
			state: "committed",
			resolvedAt: databaseNow.toISOString(),
		});
		expect(queryRawUnsafe).toHaveBeenCalledWith(
			expect.stringContaining("FOR UPDATE OF reservation, permission"),
			"execution-1",
			"business-1",
			target.id,
		);
		expect(
			transaction.standingPermissionUseReservation.updateMany,
		).toHaveBeenCalledWith({
			where: { id: "reservation-1", state: "ambiguous" },
			data: { state: "committed", updatedAt: databaseNow },
		});
		expect(transaction.auditEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "standing_permission.reservation_resolved",
				data: expect.objectContaining({
					commandExecutionId: "execution-1",
					evidenceReference: "provider-operation-1",
					outcome: "succeeded",
				}),
			}),
		});
	});
});
