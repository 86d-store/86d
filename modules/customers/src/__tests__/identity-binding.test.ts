import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { StoreCustomerIdentityInput } from "../identity-binding";
import {
	createStoreCustomerIdentityService,
	storeCustomerIdentityInputSchema,
} from "../identity-binding";

function identity(subject: string, email = "SHOPPER@Example.com") {
	return {
		identity: {
			provider: "better-auth",
			subject,
			email,
			emailVerified: true,
			firstName: "Avery",
			lastName: "Shopper",
		},
		audit: {
			source: "storefront",
			correlationId: "signin-correlation-1",
		},
	} satisfies StoreCustomerIdentityInput;
}

describe("Store Customer identity binding", () => {
	it("binds one verified principal idempotently without exposing its raw subject", async () => {
		const transactions = createMockTransactionRunner();
		const service = createStoreCustomerIdentityService(transactions);

		const first = await service.resolveOrCreate(identity("raw-auth-subject-1"));
		const replay = await service.resolveOrCreate(
			identity("raw-auth-subject-1"),
		);

		expect(first).toMatchObject({
			ok: true,
			createdCustomer: true,
			createdBinding: true,
			customer: { email: "shopper@example.com" },
		});
		expect(replay).toMatchObject({
			ok: true,
			createdCustomer: false,
			createdBinding: false,
		});
		if (!first.ok || !replay.ok) throw new Error("identity binding failed");
		expect(replay.customer.id).toBe(first.customer.id);
		expect(transactions.data.all("customer")).toHaveLength(1);
		expect(transactions.data.all("storeCustomerAuthBinding")).toHaveLength(1);
		expect(
			JSON.stringify(transactions.data.all("storeCustomerAuthBinding")),
		).not.toContain("raw-auth-subject-1");
	});

	it("does not merge a second principal merely because verified email matches", async () => {
		const service = createStoreCustomerIdentityService(
			createMockTransactionRunner(),
		);
		await service.resolveOrCreate(identity("subject-owner"));

		await expect(
			service.resolveOrCreate(identity("subject-other")),
		).resolves.toMatchObject({
			ok: false,
			code: "AUTH_IDENTITY_CONFLICT",
		});
	});

	it("rejects unverified identity and guest-claim fields without creating a Customer", async () => {
		const transactions = createMockTransactionRunner();
		const service = createStoreCustomerIdentityService(transactions);
		const unverified = {
			...identity("unverified-subject"),
			identity: {
				...identity("unverified-subject").identity,
				emailVerified: false,
			},
		};

		await expect(service.resolveOrCreate(unverified)).resolves.toMatchObject({
			ok: false,
			code: "AUTH_IDENTITY_UNVERIFIED",
		});
		expect(
			storeCustomerIdentityInputSchema.safeParse({
				...identity("claim-subject"),
				guestProof: "proof-must-be-verified-by-orders",
				orderId: "order-not-authorized-here",
			}).success,
		).toBe(false);
		expect(transactions.data.all("customer")).toHaveLength(0);
	});
});
