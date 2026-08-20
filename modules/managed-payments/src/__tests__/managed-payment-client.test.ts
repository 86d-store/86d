import { describe, expect, it, vi } from "vitest";
import {
	MANAGED_PAYMENT_WORKLOAD_SCOPES,
	STORE_RUNTIME_WORKLOAD_AUDIENCE,
} from "../contracts";
import { createManagedPaymentClient } from "../managed-payment-client";

const managedConfig = {
	storeId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	apiBaseUrl: "https://api.86d.app",
	credential: `86d_wc_abcdefghijklmnopqrstuvwx.${"s".repeat(43)}`,
};

describe("managed payment client", () => {
	it("submits an operation through the workload token seam", async () => {
		const fetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/oauth/token")) {
				return new Response(
					JSON.stringify({
						access_token: "managed-token",
						token_type: "Bearer",
						expires_in: 300,
						scope: MANAGED_PAYMENT_WORKLOAD_SCOPES.join(" "),
					}),
					{ status: 200 },
				);
			}
			expect(url).toContain("/api/v1/workloads/payments/operations/submit");
			return new Response(
				JSON.stringify({
					replayed: false,
					operation: {
						operationId: "operation-1",
						state: "confirmed",
						kind: "authorize",
					},
				}),
				{ status: 200 },
			);
		});

		const client = createManagedPaymentClient({ config: managedConfig, fetch });
		const result = await client.submitOperation({
			idempotencyKey: "authorize-checkout-1",
			provider: "86d_payments",
			mode: "sandbox",
			kind: "authorize",
			businessId: "business-1",
			merchantPaymentAccountId: "account-1",
			bindingId: "binding-1",
			connectionId: "connection-1",
			paymentId: "payment-1",
			checkoutId: "checkout-1",
			option: "card",
			amountMinorUnits: 1_000,
			currency: "USD",
		});

		expect(result).toEqual({
			replayed: false,
			operation: {
				operationId: "operation-1",
				state: "confirmed",
				kind: "authorize",
			},
		});
		expect(fetch).toHaveBeenCalled();
	});

	it("lists and acknowledges store outcomes", async () => {
		const fetch = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes("/oauth/token")) {
					return new Response(
						JSON.stringify({
							access_token: "managed-token",
							token_type: "Bearer",
							expires_in: 300,
							scope: MANAGED_PAYMENT_WORKLOAD_SCOPES.join(" "),
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/outcomes/acknowledge")) {
					return new Response(
						JSON.stringify({
							replayed: false,
							outcome: {
								id: "outcome-1",
								eventId: "event-1",
								version: 1,
								paymentSequence: 1,
								storeId: managedConfig.storeId,
								businessId: "business-1",
								bindingId: "binding-1",
								connectionId: "connection-1",
								operationId: "operation-1",
								paymentId: "payment-1",
								checkoutId: "checkout-1",
								provider: "86d_payments",
								mode: "sandbox",
								state: "confirmed",
								providerReference: "provider-ref-1",
								amountMinorUnits: 1_000,
								currency: "USD",
								occurredAt: "2026-08-14T00:00:00.000Z",
								payloadDigest: "a".repeat(64),
								deliveryState: "acknowledged",
							},
						}),
						{ status: 200 },
					);
				}
				expect(url).toContain("/api/v1/workloads/payments/outcomes");
				expect(init?.method ?? "GET").toBe("GET");
				return new Response(
					JSON.stringify({
						outcomes: [
							{
								id: "outcome-1",
								eventId: "event-1",
								version: 1,
								paymentSequence: 1,
								storeId: managedConfig.storeId,
								businessId: "business-1",
								bindingId: "binding-1",
								connectionId: "connection-1",
								operationId: "operation-1",
								paymentId: "payment-1",
								checkoutId: "checkout-1",
								provider: "86d_payments",
								mode: "sandbox",
								state: "confirmed",
								providerReference: "provider-ref-1",
								amountMinorUnits: 1_000,
								currency: "USD",
								occurredAt: "2026-08-14T00:00:00.000Z",
								payloadDigest: "a".repeat(64),
								deliveryState: "pending",
							},
						],
					}),
					{ status: 200 },
				);
			},
		);

		const client = createManagedPaymentClient({ config: managedConfig, fetch });
		const outcomes = await client.listOutcomes();
		expect(outcomes).toHaveLength(1);
		const ack = await client.acknowledgeOutcome({
			eventId: "event-1",
			acknowledgementKey: "ack-1",
		});
		expect(ack.outcome.deliveryState).toBe("acknowledged");
		expect(STORE_RUNTIME_WORKLOAD_AUDIENCE).toBe(
			"https://86d.app/api/store-runtime",
		);
	});
});
