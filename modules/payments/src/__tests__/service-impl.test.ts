import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "../service";
import { createPaymentController } from "../service-impl";

describe("createPaymentController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPaymentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPaymentController(mockData, undefined, {
			allowOfflineForDevelopment: true,
		});
	});

	// ── createIntent ─────────────────────────────────────────────────────

	describe("createIntent", () => {
		it("creates a payment intent with default values", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			expect(intent.id).toBeDefined();
			expect(intent.amount).toBe(5000);
			expect(intent.currency).toBe("USD");
			expect(intent.status).toBe("pending");
			expect(intent.metadata).toEqual({});
			expect(intent.providerMetadata).toEqual({});
			expect(intent.createdAt).toBeInstanceOf(Date);
		});

		it("creates a payment intent with custom currency", async () => {
			const intent = await controller.createIntent({
				amount: 1000,
				currency: "EUR",
			});
			expect(intent.currency).toBe("EUR");
		});

		it("creates a payment intent with customer and order", async () => {
			const intent = await controller.createIntent({
				amount: 2500,
				customerId: "cust_1",
				email: "test@example.com",
				orderId: "order_1",
				checkoutSessionId: "sess_1",
				metadata: { source: "web" },
			});
			expect(intent.customerId).toBe("cust_1");
			expect(intent.email).toBe("test@example.com");
			expect(intent.orderId).toBe("order_1");
			expect(intent.checkoutSessionId).toBe("sess_1");
			expect(intent.metadata).toEqual({ source: "web" });
		});

		it("delegates to provider when one is supplied", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_stripe_123",
					status: "processing",
					providerMetadata: { clientSecret: "secret_abc" },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 3000 });
			expect(intent.providerIntentId).toBe("pi_stripe_123");
			expect(intent.status).toBe("processing");
			expect(intent.providerMetadata).toEqual({
				clientSecret: "secret_abc",
			});
			expect(mockProvider.createIntent).toHaveBeenCalledOnce();
		});

		it("persists the intent to the data store", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const stored = await controller.getIntent(intent.id);
			expect(stored).not.toBeNull();
			expect(stored?.amount).toBe(1000);
		});
	});

	// ── getIntent ────────────────────────────────────────────────────────

	describe("getIntent", () => {
		it("returns an existing intent", async () => {
			const created = await controller.createIntent({ amount: 4200 });
			const found = await controller.getIntent(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent intent", async () => {
			const found = await controller.getIntent("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── confirmIntent ────────────────────────────────────────────────────

	describe("confirmIntent", () => {
		it("marks intent as succeeded", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
		});

		it("returns null for non-existent intent", async () => {
			const result = await controller.confirmIntent("missing_id");
			expect(result).toBeNull();
		});

		it("returns already-succeeded intent unchanged", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const again = await controller.confirmIntent(intent.id);
			expect(again?.status).toBe("succeeded");
		});

		it("delegates to provider when available", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ext",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "succeeded",
					providerMetadata: { confirmed: true },
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
			expect(confirmed?.providerMetadata).toEqual({ confirmed: true });
		});
	});

	// ── cancelIntent ─────────────────────────────────────────────────────

	describe("cancelIntent", () => {
		it("marks intent as cancelled", async () => {
			const intent = await controller.createIntent({ amount: 2000 });
			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent intent", async () => {
			const result = await controller.cancelIntent("nope");
			expect(result).toBeNull();
		});

		it("returns already-cancelled intent unchanged", async () => {
			const intent = await controller.createIntent({ amount: 2000 });
			await controller.cancelIntent(intent.id);
			const again = await controller.cancelIntent(intent.id);
			expect(again?.status).toBe("cancelled");
		});

		it("delegates to provider when available", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ext",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn().mockResolvedValue({
					providerMetadata: { voided: true },
				}),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			const cancelled = await ctrl.cancelIntent(intent.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.providerMetadata).toEqual({ voided: true });
		});
	});

	// ── listIntents ──────────────────────────────────────────────────────

	describe("listIntents", () => {
		it("lists all intents when no filters given", async () => {
			await controller.createIntent({ amount: 100 });
			await controller.createIntent({ amount: 200 });
			const all = await controller.listIntents();
			expect(all).toHaveLength(2);
		});

		it("filters by customerId", async () => {
			await controller.createIntent({
				amount: 100,
				customerId: "cust_a",
			});
			await controller.createIntent({
				amount: 200,
				customerId: "cust_b",
			});
			const results = await controller.listIntents({
				customerId: "cust_a",
			});
			expect(results).toHaveLength(1);
			expect(results[0].customerId).toBe("cust_a");
		});

		it("filters by status", async () => {
			const intent = await controller.createIntent({ amount: 100 });
			await controller.confirmIntent(intent.id);
			await controller.createIntent({ amount: 200 });
			const succeeded = await controller.listIntents({
				status: "succeeded",
			});
			expect(succeeded).toHaveLength(1);
		});

		it("filters by orderId", async () => {
			await controller.createIntent({
				amount: 100,
				orderId: "ord_1",
			});
			await controller.createIntent({ amount: 200 });
			const results = await controller.listIntents({ orderId: "ord_1" });
			expect(results).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			await controller.createIntent({ amount: 100 });
			await controller.createIntent({ amount: 200 });
			await controller.createIntent({ amount: 300 });
			const page = await controller.listIntents({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── savePaymentMethod ────────────────────────────────────────────────

	describe("savePaymentMethod", () => {
		it("saves a payment method", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_stripe_abc",
				type: "card",
				last4: "4242",
				brand: "visa",
				expiryMonth: 12,
				expiryYear: 2025,
			});
			expect(method.id).toBeDefined();
			expect(method.customerId).toBe("cust_1");
			expect(method.last4).toBe("4242");
			expect(method.isDefault).toBe(false);
		});

		it("sets isDefault and clears other defaults", async () => {
			const first = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
				isDefault: true,
			});
			expect(first.isDefault).toBe(true);

			const second = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_2",
				isDefault: true,
			});
			expect(second.isDefault).toBe(true);

			// First should now be non-default
			const updated = await controller.getPaymentMethod(first.id);
			expect(updated?.isDefault).toBe(false);
		});

		it("defaults type to card", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			expect(method.type).toBe("card");
		});
	});

	// ── getPaymentMethod / listPaymentMethods ────────────────────────────

	describe("getPaymentMethod", () => {
		it("returns a saved payment method", async () => {
			const saved = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			const found = await controller.getPaymentMethod(saved.id);
			expect(found?.providerMethodId).toBe("pm_1");
		});

		it("returns null for non-existent method", async () => {
			const found = await controller.getPaymentMethod("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listPaymentMethods", () => {
		it("lists payment methods for a customer", async () => {
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_2",
			});
			await controller.savePaymentMethod({
				customerId: "cust_2",
				providerMethodId: "pm_3",
			});
			const methods = await controller.listPaymentMethods("cust_1");
			expect(methods).toHaveLength(2);
		});
	});

	// ── deletePaymentMethod ──────────────────────────────────────────────

	describe("deletePaymentMethod", () => {
		it("deletes an existing payment method", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			const result = await controller.deletePaymentMethod(method.id);
			expect(result).toBe(true);
			const found = await controller.getPaymentMethod(method.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent method", async () => {
			const result = await controller.deletePaymentMethod("nope");
			expect(result).toBe(false);
		});
	});

	// ── createRefund ─────────────────────────────────────────────────────

	describe("createRefund", () => {
		it("creates a full refund on succeeded intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.amount).toBe(5000);
			expect(refund.status).toBe("succeeded");
			expect(refund.paymentIntentId).toBe(intent.id);

			// Intent should be marked as refunded
			const updated = await controller.getIntent(intent.id);
			expect(updated?.status).toBe("refunded");
		});

		it("creates a partial refund", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
				reason: "Partial return",
			});
			expect(refund.amount).toBe(2000);
			expect(refund.reason).toBe("Partial return");
		});

		it("throws for non-existent intent", async () => {
			await expect(
				controller.createRefund({ intentId: "missing" }),
			).rejects.toThrow("Payment intent not found");
		});

		it("throws when refunding a pending intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await expect(
				controller.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Cannot refund intent in 'pending' state");
		});

		it("throws when refunding a cancelled intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.cancelIntent(intent.id);
			await expect(
				controller.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Cannot refund intent in 'cancelled' state");
		});

		it("delegates to provider when available", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ext",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn().mockResolvedValue({
					providerRefundId: "re_ext_123",
					status: "succeeded",
				}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 3000 });
			// Provider-created intent already has succeeded status
			const refund = await ctrl.createRefund({ intentId: intent.id });
			expect(refund.providerRefundId).toBe("re_ext_123");
			expect(mockProvider.createRefund).toHaveBeenCalledOnce();
		});

		it("generates local refund ID for local-only intents", async () => {
			const intent = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.providerRefundId).toMatch(/^local_re_/);
		});

		it("throws when provider intent exists but provider is not configured", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_stripe_orphan",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrlWithProvider = createPaymentController(mockData, mockProvider);
			const intent = await ctrlWithProvider.createIntent({ amount: 5000 });

			const ctrlWithout = createPaymentController(mockData);
			await expect(
				ctrlWithout.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Payment provider is not configured");
		});

		it("rejects refund exceeding intent amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await expect(
				controller.createRefund({ intentId: intent.id, amount: 6000 }),
			).rejects.toThrow("exceeds remaining refundable amount");
		});
	});

	// ── getRefund / listRefunds ──────────────────────────────────────────

	describe("getRefund", () => {
		it("returns an existing refund", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			const found = await controller.getRefund(refund.id);
			expect(found?.id).toBe(refund.id);
		});

		it("returns null for non-existent refund", async () => {
			const found = await controller.getRefund("missing");
			expect(found).toBeNull();
		});
	});

	describe("listRefunds", () => {
		it("lists refunds for an intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({
				intentId: intent.id,
				amount: 1000,
			});
			await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
			});
			const refunds = await controller.listRefunds(intent.id);
			expect(refunds).toHaveLength(2);
		});

		it("returns empty array for intent with no refunds", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const refunds = await controller.listRefunds(intent.id);
			expect(refunds).toHaveLength(0);
		});
	});

	// ── handleWebhookEvent ───────────────────────────────────────────────

	describe("handleWebhookEvent", () => {
		it("updates intent status by providerIntentId", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_hook_1",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 5000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_hook_1",
				status: "succeeded",
				providerMetadata: { webhook: true },
			});
			expect(result?.status).toBe("succeeded");
			expect(result?.providerMetadata).toMatchObject({ webhook: true });
		});

		it("returns null when no matching intent", async () => {
			const result = await controller.handleWebhookEvent({
				providerIntentId: "pi_unknown",
				status: "succeeded",
			});
			expect(result).toBeNull();
		});

		it("returns null when status already matches", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_dup",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 1000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_dup",
				status: "succeeded",
			});
			expect(result).toBeNull();
		});
	});

	// ── handleWebhookRefund ──────────────────────────────────────────────

	describe("handleWebhookRefund", () => {
		it("creates a refund record from webhook", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_refhook",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 5000 });

			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_refhook",
				providerRefundId: "re_hook_1",
				amount: 3000,
				reason: "Customer request",
			});
			expect(result).not.toBeNull();
			expect(result?.refund.amount).toBe(3000);
			expect(result?.refund.providerRefundId).toBe("re_hook_1");
			expect(result?.refund.reason).toBe("Customer request");
			expect(result?.intent.status).toBe("refunded");

			const duplicate = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_refhook",
				providerRefundId: "re_hook_1",
				amount: 3000,
			});
			expect(duplicate).toBeNull();
			expect(await ctrl.listRefunds(result?.intent.id ?? "")).toHaveLength(1);
		});

		it("returns null when no matching intent", async () => {
			const result = await controller.handleWebhookRefund({
				providerIntentId: "pi_notfound",
				providerRefundId: "re_hook",
			});
			expect(result).toBeNull();
		});

		it("defaults refund amount to intent amount", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_full_ref",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 8000 });

			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_full_ref",
				providerRefundId: "re_full",
			});
			expect(result?.refund.amount).toBe(8000);
		});
	});
});
