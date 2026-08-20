import { describe, expect, it, vi } from "vitest";
import { createDrizzleStoreConfirmationIssuer } from "../confirmation-issuer";
import {
	computeCommandBindingHash,
	computeConfirmationNonceDigest,
} from "../grants";

const databaseNow = new Date("2026-08-11T20:00:00.000Z");
const nonce = "n".repeat(43);
const nonceDigestKey = "confirmation-nonce-digest-key-000001";
const principal = {
	type: "session" as const,
	credentialId: "session-credential-1",
	sessionId: "session-1",
};
const target = { type: "store" as const, id: "store-1" };
const command = { name: "store_runtime.settings.delete", version: 1 };
const inputDigest = "a".repeat(64);
const disclosure = "Permanently delete these Store settings.";
const bindingHash = computeCommandBindingHash({
	bindingHashVersion: 1,
	plane: "store_runtime",
	command,
	target,
	inputDigest,
	disclosure,
});

function harness(options?: {
	authorized?: boolean;
	resolvedBusinessId?: string;
}) {
	const queryRawUnsafe = vi.fn();
	const transaction = {
		confirmation: { create: vi.fn(async () => undefined) },
		auditEvent: { create: vi.fn(async () => undefined) },
		async $queryRawUnsafe<T>(query: string, ...values: unknown[]) {
			queryRawUnsafe(query, ...values);
			return [{ now: databaseNow }] as T;
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
		options?.authorized !== false
			? {
					actor: { type: "account" as const, id: "account-1" },
					authority: {
						id: "membership-1",
						type: "store_membership" as const,
						role: "owner",
						permissions: ["store:update"],
						businessId: "business-1",
						storeId: target.id,
					},
				}
			: null,
	);
	const resolveTargetScope = vi.fn(async () => ({
		businessId: options?.resolvedBusinessId ?? "business-1",
		storeId: target.id,
	}));
	let id = 0;
	const issuer = createDrizzleStoreConfirmationIssuer(client, {
		nonceDigestKey,
		createNonce: () => nonce,
		createId: (kind) => `${kind}-${++id}`,
		authorize,
		resolveTargetScope,
	});
	return {
		authorize,
		issuer,
		queryRawUnsafe,
		resolveTargetScope,
		transaction,
		transactionCalls,
	};
}

describe("Store Runtime confirmation issuer", () => {
	it("issues an exact one-time challenge using the database clock and immutable audit", async () => {
		const { authorize, issuer, queryRawUnsafe, transaction, transactionCalls } =
			harness();

		const challenge = await issuer.issue({
			principal,
			target,
			command,
			inputDigest,
			facts: {
				bindingHashVersion: 1,
				bindingHash,
				disclosure,
				businessId: "business-1",
				storeId: target.id,
			},
		});

		expect(transactionCalls).toHaveBeenCalledTimes(1);
		expect(authorize).toHaveBeenCalledWith(transaction, {
			principal,
			target,
			command,
		});
		expect(queryRawUnsafe).toHaveBeenCalledWith(
			expect.stringContaining("clock_timestamp()"),
		);
		expect(challenge).toEqual({
			reference: `confirmation-1.${nonce}`,
			command,
			target,
			disclosure,
			expiresAt: "2026-08-11T20:05:00.000Z",
		});
		expect(transaction.confirmation.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				id: "confirmation-1",
				sessionId: principal.sessionId,
				bindingHash,
				nonceDigest: computeConfirmationNonceDigest(nonceDigestKey, nonce),
				createdAt: databaseNow,
				expiresAt: new Date("2026-08-11T20:05:00.000Z"),
			}),
		});
		expect(transaction.auditEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				eventType: "confirmation.created",
				data: expect.objectContaining({ confirmationId: "confirmation-1" }),
			}),
		});
		expect(
			JSON.stringify(transaction.confirmation.create.mock.calls),
		).not.toContain(nonce);
		expect(
			JSON.stringify(transaction.auditEvent.create.mock.calls),
		).not.toContain(nonce);
	});

	it("rejects unauthorized or inexact challenges before persistence", async () => {
		const denied = harness({ authorized: false });
		await expect(
			denied.issuer.issue({
				principal,
				target,
				command,
				inputDigest,
				facts: {
					bindingHashVersion: 1,
					bindingHash,
					disclosure,
				},
			}),
		).rejects.toThrow("authorize");
		expect(denied.transaction.confirmation.create).not.toHaveBeenCalled();

		const mismatched = harness();
		await expect(
			mismatched.issuer.issue({
				principal,
				target,
				command,
				inputDigest,
				facts: {
					bindingHashVersion: 1,
					bindingHash: "b".repeat(64),
					disclosure,
				},
			}),
		).rejects.toThrow("binding hash");
		expect(mismatched.transaction.confirmation.create).not.toHaveBeenCalled();

		const crossBusiness = harness({ resolvedBusinessId: "business-2" });
		await expect(
			crossBusiness.issuer.issue({
				principal,
				target,
				command,
				inputDigest,
				facts: {
					bindingHashVersion: 1,
					bindingHash,
					disclosure,
					businessId: "business-1",
					storeId: target.id,
				},
			}),
		).rejects.toThrow("scope");
		expect(
			crossBusiness.transaction.confirmation.create,
		).not.toHaveBeenCalled();
	});
});
