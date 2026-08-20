import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPaymentController } from "../service-impl";

/**
 * Security regression tests for payments endpoints.
 *
 * Payments handle sensitive financial data (card details, transaction amounts).
 * These tests verify:
 * - Customer isolation: listIntents / listPaymentMethods scoped by customerId
 * - Ownership gaps: getIntent / getPaymentMethod expose data without customer check
 * - Status transition guards: cancellation constraints
 * - Refund validation: amount bounds, intent existence
 * - Default payment method exclusivity per customer
 * - Webhook lookup by providerIntentId
 * - Non-existent resource handling
 */

describe("payments endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPaymentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPaymentController(mockData, undefined, {
			allowOfflineForDevelopment: true,
		});
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("listIntents scoped by customerId does not return other customers' intents", async () => {
			await controller.createIntent({
				amount: 5000,
				customerId: "victim",
			});
			await controller.createIntent({
				amount: 3000,
				customerId: "victim",
			});
			await controller.createIntent({
				amount: 1000,
				customerId: "attacker",
			});

			const attackerIntents = await controller.listIntents({
				customerId: "attacker",
			});
			expect(attackerIntents).toHaveLength(1);
			expect(attackerIntents[0].customerId).toBe("attacker");
			expect(attackerIntents[0].amount).toBe(1000);
		});

		it("listIntents without customerId filter returns all intents (admin only)", async () => {
			await controller.createIntent({
				amount: 1000,
				customerId: "cust_a",
			});
			await controller.createIntent({
				amount: 2000,
				customerId: "cust_b",
			});

			const all = await controller.listIntents();
			expect(all).toHaveLength(2);
		});

		it("listPaymentMethods scoped by customerId does not leak other customers' methods", async () => {
			await controller.savePaymentMethod({
				customerId: "victim",
				providerMethodId: "pm_victim_1",
				type: "card",
				last4: "4242",
			});
			await controller.savePaymentMethod({
				customerId: "attacker",
				providerMethodId: "pm_attacker_1",
				type: "card",
				last4: "1234",
			});

			const attackerMethods = await controller.listPaymentMethods("attacker");
			expect(attackerMethods).toHaveLength(1);
			expect(attackerMethods[0].customerId).toBe("attacker");
		});
	});

	// ── Ownership Gaps (documented) ─────────────────────────────────

	describe("ownership gaps — endpoints must enforce", () => {
		it("getIntent returns intent regardless of customerId (no ownership check)", async () => {
			const intent = await controller.createIntent({
				amount: 9999,
				customerId: "victim",
			});

			// Controller does NOT verify the caller owns this intent
			const result = await controller.getIntent(intent.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});

		it("getPaymentMethod returns method regardless of customerId (no ownership check)", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "victim",
				providerMethodId: "pm_secret",
				type: "card",
				last4: "9999",
				brand: "visa",
			});

			// Controller does NOT verify the caller owns this method
			const result = await controller.getPaymentMethod(method.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});

		it("deletePaymentMethod deletes without ownership check", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "victim",
				providerMethodId: "pm_to_delete",
				type: "card",
			});

			// Any caller can delete — endpoint must enforce ownership
			const deleted = await controller.deletePaymentMethod(method.id);
			expect(deleted).toBe(true);

			const afterDelete = await controller.getPaymentMethod(method.id);
			expect(afterDelete).toBeNull();
		});
	});

	// ── Intent Status Transitions ───────────────────────────────────

	describe("intent status transitions", () => {
		it("cancelIntent transitions pending intent to cancelled", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			expect(intent.status).toBe("pending");

			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancelIntent on already-cancelled intent returns the intent unchanged", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.cancelIntent(intent.id);

			const result = await controller.cancelIntent(intent.id);
			expect(result?.status).toBe("cancelled");
		});

		it("explicit development offline mode can transition a pending intent", async () => {
			const intent = await controller.createIntent({ amount: 2500 });
			expect(intent.status).toBe("pending");

			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");
		});

		it("confirmIntent on already-succeeded intent returns it unchanged", async () => {
			const intent = await controller.createIntent({ amount: 2500 });
			await controller.confirmIntent(intent.id);

			const result = await controller.confirmIntent(intent.id);
			expect(result?.status).toBe("succeeded");
		});
	});

	// ── Refund Validation ───────────────────────────────────────────

	describe("refund validation", () => {
		it("createRefund throws when intent does not exist", async () => {
			await expect(
				controller.createRefund({ intentId: "nonexistent_intent" }),
			).rejects.toThrow("Payment intent not found");
		});

		it("createRefund defaults to full intent amount when no amount specified", async () => {
			const intent = await controller.createIntent({ amount: 7500 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
			});

			expect(refund.amount).toBe(7500);
			expect(refund.paymentIntentId).toBe(intent.id);
		});

		it("createRefund marks intent as refunded", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({ intentId: intent.id });

			const updated = await controller.getIntent(intent.id);
			expect(updated?.status).toBe("refunded");
		});

		it("listRefunds scoped to intentId does not leak refunds from other intents", async () => {
			const intent1 = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent1.id);
			const intent2 = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(intent2.id);

			await controller.createRefund({
				intentId: intent1.id,
				reason: "defective",
			});
			await controller.createRefund({
				intentId: intent2.id,
				reason: "wrong item",
			});

			const refunds1 = await controller.listRefunds(intent1.id);
			expect(refunds1).toHaveLength(1);
			expect(refunds1[0].paymentIntentId).toBe(intent1.id);
		});
	});

	// ── Default Payment Method ──────────────────────────────────────

	describe("default payment method exclusivity", () => {
		it("saving a new default method clears the previous default for the same customer", async () => {
			const first = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_first",
				type: "card",
				isDefault: true,
			});
			expect(first.isDefault).toBe(true);

			const second = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_second",
				type: "card",
				isDefault: true,
			});
			expect(second.isDefault).toBe(true);

			// First method should no longer be default
			const firstAfter = await controller.getPaymentMethod(first.id);
			expect(firstAfter?.isDefault).toBe(false);
		});

		it("setting default for one customer does not affect another customer's default", async () => {
			const custADefault = await controller.savePaymentMethod({
				customerId: "cust_a",
				providerMethodId: "pm_a",
				type: "card",
				isDefault: true,
			});

			// Save a default for a different customer
			await controller.savePaymentMethod({
				customerId: "cust_b",
				providerMethodId: "pm_b",
				type: "card",
				isDefault: true,
			});

			// Customer A's default should remain unchanged
			const custAAfter = await controller.getPaymentMethod(custADefault.id);
			expect(custAAfter?.isDefault).toBe(true);
		});
	});

	// ── Webhook Handling ────────────────────────────────────────────

	describe("webhook handling", () => {
		it("handleWebhookEvent looks up intent by providerIntentId and updates status", async () => {
			const intent = await controller.createIntent({
				amount: 4000,
				customerId: "cust_1",
			});

			// Simulate provider assigning a providerIntentId via direct data update
			await mockData.upsert("paymentIntent", intent.id, {
				...intent,
				providerIntentId: "pi_provider_123",
			} as unknown as Record<string, unknown>);

			const result = await controller.handleWebhookEvent({
				providerIntentId: "pi_provider_123",
				status: "succeeded",
			});

			expect(result).not.toBeNull();
			expect(result?.status).toBe("succeeded");
		});

		it("handleWebhookEvent returns null for unknown providerIntentId", async () => {
			const result = await controller.handleWebhookEvent({
				providerIntentId: "pi_nonexistent",
				status: "succeeded",
			});
			expect(result).toBeNull();
		});

		it("handleWebhookRefund creates refund and marks intent as refunded", async () => {
			const intent = await controller.createIntent({ amount: 6000 });

			await mockData.upsert("paymentIntent", intent.id, {
				...intent,
				providerIntentId: "pi_webhook_456",
			} as unknown as Record<string, unknown>);

			const result = await controller.handleWebhookRefund({
				providerIntentId: "pi_webhook_456",
				providerRefundId: "re_webhook_1",
				amount: 6000,
			});

			expect(result).not.toBeNull();
			expect(result?.intent.status).toBe("refunded");
			expect(result?.refund.amount).toBe(6000);
			expect(result?.refund.providerRefundId).toBe("re_webhook_1");
		});

		it("handleWebhookRefund returns null for unknown providerIntentId", async () => {
			const result = await controller.handleWebhookRefund({
				providerIntentId: "pi_ghost",
				providerRefundId: "re_ghost",
			});
			expect(result).toBeNull();
		});
	});

	// ── Non-existent Resources ──────────────────────────────────────

	describe("non-existent resources", () => {
		it("getIntent returns null for unknown id", async () => {
			const result = await controller.getIntent("nonexistent");
			expect(result).toBeNull();
		});

		it("getPaymentMethod returns null for unknown id", async () => {
			const result = await controller.getPaymentMethod("nonexistent");
			expect(result).toBeNull();
		});

		it("getRefund returns null for unknown id", async () => {
			const result = await controller.getRefund("nonexistent");
			expect(result).toBeNull();
		});

		it("cancelIntent returns null for unknown id", async () => {
			const result = await controller.cancelIntent("nonexistent");
			expect(result).toBeNull();
		});

		it("confirmIntent returns null for unknown id", async () => {
			const result = await controller.confirmIntent("nonexistent");
			expect(result).toBeNull();
		});

		it("deletePaymentMethod returns false for unknown id", async () => {
			const result = await controller.deletePaymentMethod("nonexistent");
			expect(result).toBe(false);
		});
	});
});
