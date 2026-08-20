import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	createPaymentCheckoutProvider,
	createPaymentIntentProvider,
} from "../capabilities";
import type { PaymentProvider } from "../service";
import { createPaymentController } from "../service-impl";

function clientActionProvider(
	providerMetadata: Record<string, unknown>,
): PaymentProvider {
	const intent = {
		providerIntentId: "provider-intent-1",
		status: "pending" as const,
		providerMetadata,
	};
	return {
		createIntent: async () => intent,
		confirmIntent: async () => intent,
		cancelIntent: async () => intent,
		createRefund: async () => ({
			providerRefundId: "provider-refund-1",
			status: "pending",
		}),
	};
}

describe("payments.checkout capability", () => {
	it("returns only a validated client action, never arbitrary provider metadata", async () => {
		const provider = createPaymentCheckoutProvider(
			clientActionProvider({
				clientSecret: "client-secret-1",
				internalCredential: "canary-provider-secret",
			}),
		);
		const result = await provider.handle(
			{ data: createMockDataService(), storeId: "store-1", options: {} },
			{
				operation: "create",
				amount: 2500,
				currency: "USD",
				checkoutSessionId: "checkout-1",
			},
		);

		expect(result).toEqual({
			ok: true,
			decision: {
				operation: "create",
				id: expect.any(String),
				status: "pending",
				amount: 2500,
				currency: "USD",
				clientAction: {
					type: "client_secret",
					clientSecret: "client-secret-1",
				},
			},
		});
		expect(JSON.stringify(result)).not.toContain("canary-provider-secret");
		expect(JSON.stringify(result)).not.toContain("providerMetadata");
	});
});

describe("payments.intent capability", () => {
	it("gets, lists, and refunds through payment-owned data", async () => {
		const data = createMockDataService();
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const pending = await controller.createIntent({
			amount: 2500,
			customerId: "customer-1",
			orderId: "order-1",
		});
		await controller.confirmIntent(pending.id);
		const provider = createPaymentIntentProvider(undefined, {
			allowOfflineForDevelopment: true,
		});
		const ctx = { data, storeId: "store-1", options: {} };

		await expect(
			provider.handle(ctx, { operation: "get", intentId: pending.id }),
		).resolves.toMatchObject({
			ok: true,
			decision: { operation: "get", intent: { status: "succeeded" } },
		});
		await expect(
			provider.handle(ctx, {
				operation: "list",
				customerId: "customer-1",
			}),
		).resolves.toMatchObject({
			ok: true,
			decision: { operation: "list", intents: [{ id: pending.id }] },
		});
		await expect(
			provider.handle(ctx, { operation: "refund", intentId: pending.id }),
		).resolves.toMatchObject({
			ok: true,
			decision: { operation: "refund", refund: { amount: 2500 } },
		});
	});
});
