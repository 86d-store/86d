import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "../service";
import { createPaymentController } from "../service-impl";

describe("payments edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPaymentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPaymentController(mockData, undefined, {
			allowOfflineForDevelopment: true,
		});
	});

	// ── State transition edge cases ─────────────────────────────────────

	describe("confirmIntent state transitions", () => {
		it("confirms a pending intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			expect(intent.status).toBe("pending");
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
		});

		it("confirms a processing intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_proc",
					status: "processing",
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
			expect(intent.status).toBe("processing");

			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
		});

		it("sets updatedAt when confirming", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const before = intent.updatedAt;
			// Small delay to ensure different timestamp
			await new Promise((r) => setTimeout(r, 5));
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
		});
	});

	describe("cancelIntent state transitions", () => {
		it("sets updatedAt when cancelling", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const before = intent.updatedAt;
			await new Promise((r) => setTimeout(r, 5));
			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
		});
	});

	// ── Provider error handling ──────────────────────────────────────────

	describe("provider error handling", () => {
		it("propagates provider.createIntent errors", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockRejectedValue(new Error("Gateway timeout")),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await expect(ctrl.createIntent({ amount: 1000 })).rejects.toThrow(
				"Gateway timeout",
			);
		});

		it("propagates provider.confirmIntent errors", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_err",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockRejectedValue(new Error("Card declined")),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			await expect(ctrl.confirmIntent(intent.id)).rejects.toThrow(
				"Card declined",
			);
		});

		it("propagates provider.cancelIntent errors", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_cancel_err",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn().mockRejectedValue(new Error("Cannot cancel")),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			await expect(ctrl.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel",
			);
		});

		it("propagates provider.createRefund errors", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ref_err",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi
					.fn()
					.mockRejectedValue(new Error("Refund limit exceeded")),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });
			// Provider-created intent already has 'succeeded' status
			await expect(ctrl.createRefund({ intentId: intent.id })).rejects.toThrow(
				"Refund limit exceeded",
			);
		});
	});

	// ── Provider returning non-success statuses ─────────────────────────

	describe("provider status variants", () => {
		it("handles provider returning failed status on createIntent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_fail",
					status: "failed",
					providerMetadata: { reason: "insufficient_funds" },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			expect(intent.status).toBe("failed");
			expect(intent.providerMetadata).toEqual({
				reason: "insufficient_funds",
			});
		});

		it("handles provider returning processing on confirmIntent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_slow",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "processing",
					providerMetadata: { note: "3ds_required" },
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 2000 });
			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("processing");
		});

		it("handles provider returning pending refund status", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_pend_ref",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn().mockResolvedValue({
					providerRefundId: "re_pend",
					status: "pending",
				}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });
			// Provider-created intent already has 'succeeded' status
			const refund = await ctrl.createRefund({ intentId: intent.id });
			expect(refund.status).toBe("pending");
		});
	});

	// ── Multiple refunds ────────────────────────────────────────────────

	describe("multiple refunds", () => {
		it("supports multiple partial refunds on the same intent", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			const r1 = await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
				reason: "Item 1 returned",
			});
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
				reason: "Item 2 returned",
			});
			expect(r1.amount).toBe(3000);
			expect(r2.amount).toBe(2000);

			const refunds = await controller.listRefunds(intent.id);
			expect(refunds).toHaveLength(2);
			const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
			expect(totalRefunded).toBe(5000);
		});

		it("each refund gets a unique ID", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			const r1 = await controller.createRefund({
				intentId: intent.id,
				amount: 1000,
			});
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
			});
			expect(r1.id).not.toBe(r2.id);
		});
	});

	// ── Combined filters ────────────────────────────────────────────────

	describe("listIntents combined filters", () => {
		it("combines customerId and status filters", async () => {
			await controller.createIntent({
				amount: 100,
				customerId: "cust_a",
			});
			const i2 = await controller.createIntent({
				amount: 200,
				customerId: "cust_a",
			});
			await controller.confirmIntent(i2.id);
			await controller.createIntent({
				amount: 300,
				customerId: "cust_b",
			});

			const results = await controller.listIntents({
				customerId: "cust_a",
				status: "succeeded",
			});
			expect(results).toHaveLength(1);
			expect(results[0]?.amount).toBe(200);
		});

		it("combines orderId and status filters", async () => {
			await controller.createIntent({
				amount: 100,
				orderId: "ord_1",
			});
			const i2 = await controller.createIntent({
				amount: 200,
				orderId: "ord_1",
			});
			await controller.confirmIntent(i2.id);

			const results = await controller.listIntents({
				orderId: "ord_1",
				status: "pending",
			});
			expect(results).toHaveLength(1);
			expect(results[0].amount).toBe(100);
		});

		it("returns empty when no intents match filters", async () => {
			await controller.createIntent({ amount: 100 });
			const results = await controller.listIntents({
				customerId: "nonexistent",
			});
			expect(results).toHaveLength(0);
		});

		it("returns empty when status filter matches nothing", async () => {
			await controller.createIntent({ amount: 100 });
			const results = await controller.listIntents({ status: "failed" });
			expect(results).toHaveLength(0);
		});
	});

	// ── Payment methods edge cases ──────────────────────────────────────

	describe("payment methods edge cases", () => {
		it("returns empty array for customer with no methods", async () => {
			const methods = await controller.listPaymentMethods("no_methods_cust");
			expect(methods).toHaveLength(0);
		});

		it("does not clear defaults for different customers", async () => {
			const m1 = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
				isDefault: true,
			});
			const m2 = await controller.savePaymentMethod({
				customerId: "cust_2",
				providerMethodId: "pm_2",
				isDefault: true,
			});

			// Both should still be defaults
			const check1 = await controller.getPaymentMethod(m1.id);
			const check2 = await controller.getPaymentMethod(m2.id);
			expect(check1?.isDefault).toBe(true);
			expect(check2?.isDefault).toBe(true);
		});

		it("saves method with all optional fields", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_full",
				type: "card",
				last4: "1234",
				brand: "mastercard",
				expiryMonth: 6,
				expiryYear: 2028,
				isDefault: false,
			});
			expect(method.type).toBe("card");
			expect(method.last4).toBe("1234");
			expect(method.brand).toBe("mastercard");
			expect(method.expiryMonth).toBe(6);
			expect(method.expiryYear).toBe(2028);
		});

		it("saves method with non-card type", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_bank",
				type: "bank_account",
			});
			expect(method.type).toBe("bank_account");
		});
	});

	// ── Webhook edge cases ──────────────────────────────────────────────

	describe("webhook edge cases", () => {
		it("handleWebhookEvent merges providerMetadata", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_merge",
					status: "pending",
					providerMetadata: { initial: true },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 1000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_merge",
				status: "succeeded",
				providerMetadata: { webhook: true },
			});
			expect(result?.providerMetadata).toEqual({
				initial: true,
				webhook: true,
			});
		});

		it("handleWebhookEvent without providerMetadata preserves existing", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_no_meta",
					status: "pending",
					providerMetadata: { original: "data" },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 2000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_no_meta",
				status: "succeeded",
			});
			expect(result?.providerMetadata).toEqual({ original: "data" });
		});

		it("handleWebhookEvent transitions to failed status", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_will_fail",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 3000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_will_fail",
				status: "failed",
				providerMetadata: { error: "card_declined" },
			});
			expect(result?.status).toBe("failed");
		});

		it("handleWebhookRefund with reason", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ref_reason",
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
				providerIntentId: "pi_ref_reason",
				providerRefundId: "re_reason",
				amount: 2500,
				reason: "Duplicate charge",
			});
			expect(result?.refund.reason).toBe("Duplicate charge");
			expect(result?.refund.amount).toBe(2500);
		});

		it("handleWebhookRefund marks intent as refunded", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_ref_status",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 3000 });

			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_ref_status",
				providerRefundId: "re_status",
				amount: 3000,
			});
			expect(result?.intent.status).toBe("refunded");

			// Verify persisted
			const all = await ctrl.listIntents({ status: "refunded" });
			expect(all).toHaveLength(1);
		});
	});

	// ── Refund edge cases ───────────────────────────────────────────────

	describe("refund edge cases", () => {
		it("refund reason is optional", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.reason).toBeUndefined();
		});

		it("refund preserves paymentIntentId", async () => {
			const intent = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				amount: 500,
			});
			expect(refund.paymentIntentId).toBe(intent.id);
		});

		it("refund sets createdAt and updatedAt", async () => {
			const intent = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.createdAt).toBeInstanceOf(Date);
			expect(refund.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── No-op confirmIntent on local controller ─────────────────────────

	describe("explicit development offline mode", () => {
		it("confirmIntent skips provider delegation", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
			expect(confirmed?.providerMetadata).toEqual({});
		});

		it("cancelIntent skips provider delegation", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.providerMetadata).toEqual({});
		});

		it("creates a local refund only when development mode was explicitly enabled", async () => {
			const intent = await controller.createIntent({ amount: 3000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				amount: 1000,
			});
			expect(refund.providerRefundId).toMatch(/^local_re_/);
			expect(refund.status).toBe("succeeded");
		});
	});
});
