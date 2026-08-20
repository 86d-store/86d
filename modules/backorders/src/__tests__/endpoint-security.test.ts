import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Backorder } from "../service";
import { createBackordersController } from "../service-impl";

/**
 * Security regression tests for backorders endpoints.
 *
 * Backorders expose customer PII (email, order references) and stock data.
 * These tests verify:
 * - Customer isolation: customer A cannot see customer B's backorders
 * - Backorder quantity validation: policy limits are enforced
 * - Status transitions: cancelled/delivered backorders are protected
 * - Notification integrity: customer email stays bound to the creating customer
 * - Product-level backorder scoping: operations target the correct product
 */

function makeBackorderParams(
	overrides?: Partial<Parameters<typeof controller.createBackorder>[0]>,
) {
	return {
		productId: "prod_1",
		productName: "Widget",
		customerId: "cust_1",
		customerEmail: "alice@example.com",
		quantity: 1,
		...overrides,
	};
}

let controller: ReturnType<typeof createBackordersController>;

describe("backorders endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBackordersController(mockData);
	});

	// helper: create and assert non-null
	async function mustCreate(
		overrides?: Partial<Parameters<typeof controller.createBackorder>[0]>,
	): Promise<Backorder> {
		const result = await controller.createBackorder(
			makeBackorderParams(overrides),
		);
		if (!result) throw new Error("Expected backorder to be created");
		return result;
	}

	async function enablePolicy(
		productId: string,
		overrides?: {
			maxQuantityPerOrder?: number;
			maxTotalBackorders?: number;
			estimatedLeadDays?: number;
			autoConfirm?: boolean;
			message?: string;
		},
	) {
		return controller.setPolicy({
			productId,
			enabled: true,
			autoConfirm: overrides?.autoConfirm ?? false,
			...overrides,
		});
	}

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getCustomerBackorders never returns another customer's backorders", async () => {
			await mustCreate({ customerId: "victim" });
			await mustCreate({
				customerId: "victim",
				customerEmail: "victim@example.com",
				productId: "prod_2",
				productName: "Gadget",
			});
			await mustCreate({
				customerId: "attacker",
				customerEmail: "attacker@example.com",
			});

			const attackerResults =
				await controller.getCustomerBackorders("attacker");
			expect(attackerResults).toHaveLength(1);
			for (const bo of attackerResults) {
				expect(bo.customerId).toBe("attacker");
			}
		});

		it("listBackorders with customerId filter does not leak other customers", async () => {
			await mustCreate({ customerId: "cust_a" });
			await mustCreate({
				customerId: "cust_b",
				customerEmail: "b@example.com",
			});

			const filtered = await controller.listBackorders({
				customerId: "cust_a",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].customerId).toBe("cust_a");
		});

		it("getBackorder exposes backorder regardless of caller (endpoint must enforce ownership)", async () => {
			const bo = await mustCreate({ customerId: "victim" });
			// The controller does NOT check ownership — the endpoint layer must
			const result = await controller.getBackorder(bo.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});

		it("customer email is preserved exactly as provided at creation", async () => {
			const bo = await mustCreate({
				customerId: "cust_x",
				customerEmail: "Original@Email.COM",
			});
			const found = await controller.getBackorder(bo.id);
			expect(found?.customerEmail).toBe("Original@Email.COM");
		});
	});

	// ── Backorder Quantity Validation ────────────────────────────────

	describe("backorder quantity validation", () => {
		it("rejects quantity exceeding maxQuantityPerOrder policy", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 3 });
			const result = await controller.createBackorder(
				makeBackorderParams({ quantity: 5 }),
			);
			expect(result).toBeNull();
		});

		it("allows quantity exactly at maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 3 });
			const bo = await mustCreate({ quantity: 3 });
			expect(bo.quantity).toBe(3);
		});

		it("rejects when cumulative quantity would exceed maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 7 });
			const result = await controller.createBackorder(
				makeBackorderParams({
					quantity: 5,
					customerId: "cust_2",
					customerEmail: "bob@example.com",
				}),
			);
			expect(result).toBeNull();
		});

		it("cancelled backorders do not count toward total capacity", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const first = await mustCreate({ quantity: 5 });
			await controller.cancelBackorder(first.id);

			// After cancellation the capacity is freed
			const second = await mustCreate({
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(second).not.toBeNull();
		});

		it("eligibility check enforces per-order max independently of total", async () => {
			await enablePolicy("prod_1", {
				maxQuantityPerOrder: 2,
				maxTotalBackorders: 100,
			});
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("2");
		});
	});

	// ── Status Transition Guards ────────────────────────────────────

	describe("status transition guards", () => {
		it("cancelBackorder is a no-op on already cancelled backorder", async () => {
			const bo = await mustCreate();
			const first = await controller.cancelBackorder(bo.id, "reason A");
			const second = await controller.cancelBackorder(bo.id, "reason B");
			// Should return the already-cancelled record, not re-cancel
			expect(second?.status).toBe("cancelled");
			expect(second?.cancelReason).toBe(first?.cancelReason);
		});

		it("cancelBackorder is a no-op on delivered backorder", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "delivered");
			const result = await controller.cancelBackorder(bo.id, "too late");
			expect(result?.status).toBe("delivered");
			expect(result?.cancelledAt).toBeUndefined();
		});

		it("updateStatus sets cancelledAt timestamp on cancellation", async () => {
			const bo = await mustCreate();
			const cancelled = await controller.updateStatus(
				bo.id,
				"cancelled",
				"Policy violation",
			);
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled?.cancelReason).toBe("Policy violation");
		});

		it("updateStatus returns null for non-existent backorder id", async () => {
			const result = await controller.updateStatus(
				"non_existent_id",
				"confirmed",
			);
			expect(result).toBeNull();
		});

		it("bulkUpdateStatus skips non-existent ids without failing", async () => {
			const bo = await mustCreate();
			const result = await controller.bulkUpdateStatus(
				[bo.id, "ghost_id_1", "ghost_id_2"],
				"confirmed",
			);
			expect(result.updated).toBe(1);
			const found = await controller.getBackorder(bo.id);
			expect(found?.status).toBe("confirmed");
		});
	});

	// ── Notification Integrity ──────────────────────────────────────

	describe("notification integrity", () => {
		it("status update preserves customer email for notification routing", async () => {
			const bo = await mustCreate({
				customerEmail: "notify-me@example.com",
			});
			const updated = await controller.updateStatus(bo.id, "shipped");
			expect(updated?.customerEmail).toBe("notify-me@example.com");
		});

		it("cancel preserves customer email for cancellation notice", async () => {
			const bo = await mustCreate({
				customerEmail: "notify-me@example.com",
			});
			const cancelled = await controller.cancelBackorder(bo.id, "out of stock");
			expect(cancelled?.customerEmail).toBe("notify-me@example.com");
		});

		it("allocateStock preserves customer details on allocated backorders", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo = await mustCreate({
				customerEmail: "warehouse@example.com",
				quantity: 2,
			});
			await controller.allocateStock("prod_1", 10);

			const allocated = await controller.getBackorder(bo.id);
			expect(allocated?.status).toBe("allocated");
			expect(allocated?.customerEmail).toBe("warehouse@example.com");
			expect(allocated?.customerId).toBe("cust_1");
		});
	});

	// ── Product-Level Backorder Scoping ─────────────────────────────

	describe("product-level backorder scoping", () => {
		it("allocateStock only targets the specified product", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await enablePolicy("prod_2", { autoConfirm: true });

			await mustCreate({ productId: "prod_1", quantity: 2 });
			await mustCreate({
				productId: "prod_2",
				productName: "Other Widget",
				quantity: 3,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});

			const result = await controller.allocateStock("prod_1", 10);
			expect(result.allocated).toBe(1);

			// prod_2 backorder should remain confirmed, not allocated
			const prod2List = await controller.listBackorders({
				productId: "prod_2",
			});
			expect(prod2List[0]?.status).toBe("confirmed");
		});

		it("countByProduct only counts the specified product", async () => {
			await mustCreate({ productId: "prod_a", productName: "A" });
			await mustCreate({
				productId: "prod_a",
				productName: "A",
				customerId: "cust_2",
				customerEmail: "b@x.com",
			});
			await mustCreate({
				productId: "prod_b",
				productName: "B",
				customerId: "cust_3",
				customerEmail: "c@x.com",
			});

			expect(await controller.countByProduct("prod_a")).toBe(2);
			expect(await controller.countByProduct("prod_b")).toBe(1);
			expect(await controller.countByProduct("prod_c")).toBe(0);
		});

		it("policy for one product does not affect another product", async () => {
			await controller.setPolicy({
				productId: "prod_1",
				enabled: false,
				autoConfirm: false,
			});

			// prod_1 is disabled, so creating a backorder fails
			const blocked = await controller.createBackorder(
				makeBackorderParams({ productId: "prod_1" }),
			);
			expect(blocked).toBeNull();

			// prod_2 has no policy, so creation succeeds (no policy = allowed)
			const allowed = await mustCreate({
				productId: "prod_2",
				productName: "Other",
			});
			expect(allowed).not.toBeNull();
		});

		it("deleting a policy for one product does not affect another", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			await enablePolicy("prod_2", { maxQuantityPerOrder: 10 });

			await controller.deletePolicy("prod_1");

			const prod1Policy = await controller.getPolicy("prod_1");
			const prod2Policy = await controller.getPolicy("prod_2");
			expect(prod1Policy).toBeNull();
			expect(prod2Policy).not.toBeNull();
			expect(prod2Policy?.maxQuantityPerOrder).toBe(10);
		});

		it("eligibility check is scoped to the queried product", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 2 });
			await mustCreate({ productId: "prod_1", quantity: 2 });

			// prod_1 is at capacity
			const prod1Check = await controller.checkEligibility("prod_1", 1);
			expect(prod1Check.eligible).toBe(false);

			// prod_2 has no policy, so it's ineligible for a different reason
			const prod2Check = await controller.checkEligibility("prod_2", 1);
			expect(prod2Check.eligible).toBe(false);
			expect(prod2Check.reason).toBe("Backorders not available");
		});

		it("summary topProducts accurately reflects per-product counts", async () => {
			for (let i = 0; i < 4; i++) {
				await mustCreate({
					productId: "popular",
					productName: "Popular Item",
					customerId: `cust_${i}`,
					customerEmail: `u${i}@example.com`,
				});
			}
			await mustCreate({
				productId: "niche",
				productName: "Niche Item",
				customerId: "cust_n",
				customerEmail: "niche@example.com",
			});

			const summary = await controller.getSummary();
			expect(summary.topProducts[0]?.productId).toBe("popular");
			expect(summary.topProducts[0]?.count).toBe(4);
			expect(summary.topProducts[1]?.productId).toBe("niche");
			expect(summary.topProducts[1]?.count).toBe(1);
		});
	});
});
