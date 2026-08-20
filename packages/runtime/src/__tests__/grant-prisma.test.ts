import { describe, expect, it, vi } from "vitest";
import {
	createPrismaCommandGrantAdapter,
	type PrismaCommandGrantTransaction,
} from "../grant-prisma";
import {
	computeChangeSetReviewHash,
	computeCommandBindingHash,
	createConfirmationProof,
} from "../grants";

describe("Prisma Command grant admission", () => {
	it("atomically invalidates a drifted approval and appends its audit", async () => {
		const execute = vi.fn(async () => 1);
		const transaction: PrismaCommandGrantTransaction = {
			async $queryRawUnsafe<T>() {
				return [] as T;
			},
			$executeRawUnsafe: execute,
		};
		const adapter = createPrismaCommandGrantAdapter({
			nonceDigestKey: "confirmation-nonce-key-at-least-32-bytes",
			createAuditId: () => "audit-conflict-001",
		});
		const target = { type: "store" as const, id: "store-001" };

		await adapter.recordDenied?.(
			transaction,
			{
				executionId: "execution-001",
				principal: {
					type: "session",
					credentialId: "account-001",
					sessionId: "session-001",
				},
				plane: "store_runtime",
				command: { name: "store_runtime.settings.publish", version: 1 },
				inputDigest: "a".repeat(64),
				actor: { type: "account", id: "account-001" },
				authority: {
					id: "membership-001",
					type: "store_membership",
					permissions: ["store:update"],
					businessId: "business-001",
					storeId: target.id,
				},
				target,
				policy: { kind: "approval" },
				approvalReference: "approval-001",
				resolveFacts: async () => ({
					bindingHashVersion: 1,
					bindingHash: "b".repeat(64),
					disclosure: "Publish Store settings",
					baseRevisions: [{ target, revision: "revision-002" }],
				}),
			},
			{
				code: "approval_invalid",
				message: "The base revisions changed.",
				retryable: false,
				details: {
					reason: "base_revision_conflict",
					changeSetId: "change-set-001",
					approvalId: "approval-001",
				},
			},
		);

		expect(execute).toHaveBeenCalledTimes(1);
		const [sql, ...values] = (execute.mock.calls[0] ?? []) as unknown as [
			string,
			...unknown[],
		];
		expect(sql).toContain('UPDATE "ChangeSet"');
		expect(sql).toContain('UPDATE "Approval"');
		expect(sql).toContain('INSERT INTO "AuditEvent"');
		expect(sql).toContain("clock_timestamp()");
		expect(values).toContain("audit-conflict-001");
		expect(values).toContain("approval-001");
	});

	it("rejects a confirmation that expires while waiting for its row lock", async () => {
		const command = { name: "store_runtime.settings.publish", version: 1 };
		const target = { type: "store" as const, id: "store-001" };
		const actor = { type: "account" as const, id: "account-001" };
		const authority = {
			id: "membership-001",
			type: "store_membership" as const,
			permissions: ["store:update"],
			businessId: "business-001",
			storeId: target.id,
		};
		const inputDigest = "a".repeat(64);
		const disclosure = "Publish Store settings now.";
		const bindingHash = computeCommandBindingHash({
			bindingHashVersion: 1,
			plane: "store_runtime",
			command,
			target,
			inputDigest,
			disclosure,
		});
		const nonceDigestKey = "confirmation-nonce-key-at-least-32-bytes";
		const nonce = "confirmation-proof-nonce-00000001";
		let rowLocked = false;
		const transaction: PrismaCommandGrantTransaction = {
			async $queryRawUnsafe<T>(query: string) {
				if (query.includes("FOR UPDATE")) {
					rowLocked = true;
					return [{ id: "confirmation-001" }] as T;
				}
				if (query.includes('UPDATE "Confirmation"')) {
					return (
						rowLocked && query.includes("clock_timestamp()")
							? []
							: [{ id: "confirmation-001", bindingHash }]
					) as T;
				}
				return [] as T;
			},
			async $executeRawUnsafe() {
				return 0;
			},
		};
		const adapter = createPrismaCommandGrantAdapter({ nonceDigestKey });

		expect(
			await adapter.admit(transaction, {
				executionId: "execution-001",
				principal: {
					type: "session",
					credentialId: actor.id,
					sessionId: "session-001",
				},
				plane: "store_runtime",
				command,
				inputDigest,
				actor,
				authority,
				target,
				policy: {
					kind: "confirmation",
					standingPermission: "forbidden",
					freshOnly: true,
				},
				confirmationReference: createConfirmationProof(
					"confirmation-001",
					nonce,
				),
				resolveFacts: () => ({
					bindingHashVersion: 1,
					bindingHash,
					disclosure,
					businessId: authority.businessId,
					storeId: target.id,
					baseRevisions: undefined,
				}),
			}),
		).toMatchObject({
			ok: false,
			failure: { code: "confirmation_invalid" },
		});
	});

	it("rejects a standing permission that expires while waiting for its row lock", async () => {
		const command = { name: "store_runtime.payment.charge", version: 1 };
		const target = { type: "store" as const, id: "store-001" };
		const actor = { type: "account" as const, id: "account-001" };
		const authority = {
			id: "membership-001",
			type: "store_membership" as const,
			permissions: ["payment:charge"],
			businessId: "business-001",
			storeId: target.id,
		};
		const inputDigest = "a".repeat(64);
		const disclosure = "Charge 10 USD.";
		const bindingHash = computeCommandBindingHash({
			bindingHashVersion: 1,
			plane: "store_runtime",
			command,
			target,
			inputDigest,
			disclosure,
			amount: "10",
			currency: "USD",
		});
		const transaction: PrismaCommandGrantTransaction = {
			async $queryRawUnsafe<T>(query: string) {
				if (query.includes('FROM "StandingPermission"\n')) {
					return [
						{
							id: "standing-001",
							perOperationAmount: "50",
							aggregateAmount: "100",
							currency: "USD",
							validFrom: new Date("2026-08-11T19:00:00.000Z"),
							validUntil: new Date("2026-08-11T20:00:00.000Z"),
							revokedAt: null,
						},
					] as T;
				}
				if (query.includes("clock_timestamp()")) {
					return [{ now: new Date("2026-08-11T20:00:01.000Z") }] as T;
				}
				if (query.includes("SUM")) return [{ total: "0" }] as T;
				return [] as T;
			},
			async $executeRawUnsafe() {
				return 1;
			},
		};
		const adapter = createPrismaCommandGrantAdapter({
			nonceDigestKey: "confirmation-nonce-key-at-least-32-bytes",
			createReservationId: () => "reservation-001",
		});

		expect(
			await adapter.admit(transaction, {
				executionId: "execution-001",
				principal: {
					type: "session",
					credentialId: actor.id,
					sessionId: "session-001",
				},
				plane: "store_runtime",
				command,
				inputDigest,
				actor,
				authority,
				target,
				policy: {
					kind: "confirmation",
					standingPermission: "allowed",
					freshOnly: false,
				},
				resolveFacts: () => ({
					bindingHashVersion: 1,
					bindingHash,
					disclosure,
					amount: "10",
					currency: "USD",
					businessId: authority.businessId,
					storeId: target.id,
					baseRevisions: undefined,
				}),
			}),
		).toMatchObject({
			ok: false,
			failure: { code: "confirmation_required" },
		});
	});

	it("admits an approved first-generation Change Set with no superseded parent", async () => {
		const target = { type: "store" as const, id: "store-001" };
		const command = { name: "store_runtime.settings.publish", version: 1 };
		const actor = { type: "account" as const, id: "account-001" };
		const authority = {
			id: "membership-001",
			type: "store_membership" as const,
			permissions: ["store:update"],
			businessId: "business-001",
			storeId: target.id,
		};
		const baseRevisions = [{ target, revision: "revision-001" }];
		const changeSet = {
			id: "change-set-001",
			version: 1,
			changeSetHashVersion: 1,
			ownerPlane: "store_runtime" as const,
			status: "approved" as const,
			reviewHash: "0".repeat(64),
			target,
			proposal: { command, target, inputDigest: "a".repeat(64) },
			supersedesChangeSetId: null,
			baseRevisions,
			affectedTargets: [target],
			beforeSummary: {},
			afterSummary: { published: true },
			publicEffects: ["Publishes settings"],
			operationalEffects: [],
			estimatedCharges: [],
			requiredPermissions: ["store:update"],
			validationBlocks: [],
			rollbackCoverage: "database" as const,
			createdAt: "2026-08-11T20:00:00.000Z",
			updatedAt: "2026-08-11T20:01:00.000Z",
			immutableAt: "2026-08-11T20:01:00.000Z",
		};
		const reviewHash = computeChangeSetReviewHash({
			...changeSet,
			supersedesChangeSetId: undefined,
		});
		changeSet.reviewHash = reviewHash;

		const transaction: PrismaCommandGrantTransaction = {
			async $queryRawUnsafe<T>() {
				return [
					{
						id: "approval-001",
						changeSetId: changeSet.id,
						reviewHash,
						baseRevisions,
						actor,
						authority,
						invalidatedAt: null,
						alreadyUsed: false,
						changeSet,
					},
				] as T;
			},
			async $executeRawUnsafe() {
				return 0;
			},
		};
		const adapter = createPrismaCommandGrantAdapter({
			nonceDigestKey: "confirmation-nonce-key-at-least-32-bytes",
		});

		await expect(
			adapter.admit(transaction, {
				executionId: "execution-001",
				principal: {
					type: "session",
					credentialId: "credential-001",
					sessionId: "session-001",
				},
				plane: "store_runtime",
				command,
				inputDigest: changeSet.proposal.inputDigest,
				actor,
				authority,
				target,
				policy: { kind: "approval" },
				approvalReference: "approval-001",
				resolveFacts: () => ({
					bindingHashVersion: 1,
					bindingHash: "b".repeat(64),
					disclosure: "Publish settings",
					businessId: "business-001",
					storeId: target.id,
					baseRevisions,
				}),
			}),
		).resolves.toMatchObject({
			ok: true,
			grantUse: {
				kind: "approval",
				approvalId: "approval-001",
				changeSetId: "change-set-001",
			},
		});
	});
});
