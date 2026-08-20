import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "../service";
import { createPaymentController } from "../service-impl";

/**
 * Financial safety regression tests.
 *
 * These tests verify the hardened payment controller prevents:
 * - Negative or zero-amount intents
 * - Refunds on non-succeeded intents
 * - Refunds exceeding the original charge
 * - Confirming or cancelling terminal-state intents
 * - Duplicate webhook refunds
 */

describe("financial safety guards", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPaymentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPaymentController(mockData, undefined, {
			allowOfflineForDevelopment: true,
		});
	});

	// ── Amount validation ──────────────────────────────────────────────

	describe("intent amount validation", () => {
		it("rejects zero amount", async () => {
			await expect(controller.createIntent({ amount: 0 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("rejects negative amount", async () => {
			await expect(controller.createIntent({ amount: -100 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("rejects fractional amount", async () => {
			await expect(controller.createIntent({ amount: 49.99 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("accepts minimum valid amount (1 cent)", async () => {
			const intent = await controller.createIntent({ amount: 1 });
			expect(intent.amount).toBe(1);
			expect(intent.status).toBe("pending");
		});

		it("accepts large integer amount", async () => {
			const intent = await controller.createIntent({ amount: 999999999 });
			expect(intent.amount).toBe(999999999);
		});
	});

	// ── Confirm status guards ──────────────────────────────────────────

	describe("confirmIntent status guards", () => {
		it("confirms pending intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
		});

		it("returns already-succeeded intent unchanged", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			const again = await controller.confirmIntent(intent.id);
			expect(again?.status).toBe("succeeded");
		});

		it("rejects confirming cancelled intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.cancelIntent(intent.id);
			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'cancelled' state",
			);
		});

		it("rejects confirming failed intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_fail",
					status: "failed",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			expect(intent.status).toBe("failed");
			await expect(ctrl.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'failed' state",
			);
		});

		it("rejects confirming refunded intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({ intentId: intent.id });
			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'refunded' state",
			);
		});
	});

	// ── Cancel status guards ───────────────────────────────────────────

	describe("cancelIntent status guards", () => {
		it("cancels pending intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns already-cancelled intent unchanged", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.cancelIntent(intent.id);
			const again = await controller.cancelIntent(intent.id);
			expect(again?.status).toBe("cancelled");
		});

		it("rejects cancelling succeeded intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			await expect(controller.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel intent in 'succeeded' state",
			);
		});

		it("rejects cancelling refunded intent", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({ intentId: intent.id });
			await expect(controller.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel intent in 'refunded' state",
			);
		});

		it("rejects cancelling failed intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_fail",
					status: "failed",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			await expect(ctrl.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel intent in 'failed' state",
			);
		});
	});

	// ── Refund status guards ───────────────────────────────────────────

	describe("createRefund status guards", () => {
		it("refunds succeeded intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.amount).toBe(5000);
		});

		it("refunds already-refunded intent (partial refunds)", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
			});
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 1000,
			});
			expect(r2.amount).toBe(1000);
		});

		it("rejects refunding pending intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await expect(
				controller.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Cannot refund intent in 'pending' state");
		});

		it("rejects refunding cancelled intent", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.cancelIntent(intent.id);
			await expect(
				controller.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Cannot refund intent in 'cancelled' state");
		});

		it("rejects refunding failed intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_fail",
					status: "failed",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });
			await expect(ctrl.createRefund({ intentId: intent.id })).rejects.toThrow(
				"Cannot refund intent in 'failed' state",
			);
		});
	});

	// ── Refund amount cap ──────────────────────────────────────────────

	describe("refund amount cap", () => {
		it("allows full refund equal to intent amount", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				amount: 10000,
			});
			expect(refund.amount).toBe(10000);
		});

		it("allows default full refund (no amount specified)", async () => {
			const intent = await controller.createIntent({ amount: 7500 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});
			expect(refund.amount).toBe(7500);
		});

		it("rejects refund exceeding intent amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 5001,
				}),
			).rejects.toThrow(
				"Refund amount 5001 exceeds remaining refundable amount 5000",
			);
		});

		it("rejects partial refunds that cumulatively exceed intent amount", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);

			// First refund: 6000
			await controller.createRefund({
				intentId: intent.id,
				amount: 6000,
			});

			// Second refund: 3000 (total 9000, OK)
			await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
			});

			// Third refund: 2000 (would total 11000, REJECTED)
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 2000,
				}),
			).rejects.toThrow(
				"Refund amount 2000 exceeds remaining refundable amount 1000",
			);
		});

		it("allows final refund consuming exact remaining amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);

			await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
			});

			const final = await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
			});
			expect(final.amount).toBe(2000);
		});

		it("rejects any refund after full refund", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);

			await controller.createRefund({ intentId: intent.id });

			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 1,
				}),
			).rejects.toThrow(
				"Refund amount 1 exceeds remaining refundable amount 0",
			);
		});

		it("rejects zero refund amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 0,
				}),
			).rejects.toThrow("Refund amount must be positive");
		});

		it("rejects negative refund amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: -100,
				}),
			).rejects.toThrow("Refund amount must be positive");
		});

		it("excludes failed refunds from cumulative total", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_partial_fail",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi
					.fn()
					.mockResolvedValueOnce({
						providerRefundId: "re_ok",
						status: "succeeded",
					})
					.mockResolvedValueOnce({
						providerRefundId: "re_fail",
						status: "failed",
					})
					.mockResolvedValueOnce({
						providerRefundId: "re_ok2",
						status: "succeeded",
					}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 10000 });

			// First refund: 5000 succeeded
			await ctrl.createRefund({
				intentId: intent.id,
				amount: 5000,
			});

			// Second refund: 3000 failed (shouldn't count toward cap)
			await ctrl.createRefund({
				intentId: intent.id,
				amount: 3000,
			});

			// Third refund: 5000 should work (only 5000 succeeded so far)
			const r3 = await ctrl.createRefund({
				intentId: intent.id,
				amount: 5000,
			});
			expect(r3.amount).toBe(5000);
		});
	});

	// ── Webhook refund deduplication ────────────────────────────────────

	describe("webhook refund deduplication", () => {
		it("processes first webhook refund normally", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_dedup",
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
				providerIntentId: "pi_dedup",
				providerRefundId: "re_first",
				amount: 3000,
			});

			expect(result).not.toBeNull();
			expect(result?.refund.amount).toBe(3000);
			expect(result?.intent.status).toBe("refunded");
		});

		it("returns null on duplicate providerRefundId", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_dedup2",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });

			// First webhook
			const first = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_dedup2",
				providerRefundId: "re_dup",
				amount: 3000,
			});

			// Duplicate webhook (retry)
			const second = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_dedup2",
				providerRefundId: "re_dup",
				amount: 3000,
			});

			// A null result tells webhook endpoints not to re-emit a business event.
			expect(first).not.toBeNull();
			expect(second).toBeNull();

			// Only one refund record should exist
			const refunds = await ctrl.listRefunds(intent.id);
			expect(refunds).toHaveLength(1);
		});

		it("allows different providerRefundIds for same intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_multi",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 10000 });

			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_multi",
				providerRefundId: "re_a",
				amount: 3000,
			});
			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_multi",
				providerRefundId: "re_b",
				amount: 4000,
			});

			const refunds = await ctrl.listRefunds(intent.id);
			expect(refunds).toHaveLength(2);
			const total = refunds.reduce((s, r) => s + r.amount, 0);
			expect(total).toBe(7000);
		});

		it("dedup returns null even if amount differs in retry", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_dedup3",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 5000 });

			// First call
			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_dedup3",
				providerRefundId: "re_same",
				amount: 3000,
			});

			// Retry with different amount (shouldn't matter — dedup by providerRefundId)
			const second = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_dedup3",
				providerRefundId: "re_same",
				amount: 9999,
			});

			expect(second).toBeNull();
		});
	});

	// ── Combined lifecycle with guards ─────────────────────────────────

	describe("end-to-end lifecycle with safety guards", () => {
		it("complete happy path: create → confirm → partial refund → rest refund", async () => {
			const intent = await controller.createIntent({
				amount: 10000,
				customerId: "cust_safe",
			});
			expect(intent.status).toBe("pending");

			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");

			// Can't cancel after confirm
			await expect(controller.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel intent in 'succeeded' state",
			);

			// Partial refund
			const r1 = await controller.createRefund({
				intentId: intent.id,
				amount: 4000,
			});
			expect(r1.amount).toBe(4000);

			// Remaining: 6000
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 6000,
			});
			expect(r2.amount).toBe(6000);

			// Fully refunded — no more refunds allowed
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 1,
				}),
			).rejects.toThrow("exceeds remaining refundable amount 0");

			// Can't confirm refunded intent
			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'refunded' state",
			);
		});

		it("cancel path: create → cancel, no further transitions", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.cancelIntent(intent.id);

			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'cancelled' state",
			);

			await expect(
				controller.createRefund({ intentId: intent.id }),
			).rejects.toThrow("Cannot refund intent in 'cancelled' state");
		});
	});
});
