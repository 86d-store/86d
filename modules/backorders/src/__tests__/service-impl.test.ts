import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Backorder } from "../service";
import { createBackordersController } from "../service-impl";

describe("createBackordersController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBackordersController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBackordersController(mockData);
	});

	// ── helpers ───────────────────────────────────────────────────────────

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

	async function mustCreate(
		overrides?: Partial<Parameters<typeof controller.createBackorder>[0]>,
	): Promise<Backorder> {
		const result = await controller.createBackorder({
			productId: "prod_1",
			productName: "Test Product",
			customerId: "cust_1",
			customerEmail: "alice@example.com",
			quantity: 1,
			...overrides,
		});
		if (!result) throw new Error("Expected backorder to be created");
		return result;
	}

	// ── createBackorder ──────────────────────────────────────────────────

	describe("createBackorder", () => {
		it("creates a backorder when no policy exists", async () => {
			const bo = await mustCreate();
			expect(bo.id).toBeDefined();
			expect(bo.productId).toBe("prod_1");
			expect(bo.productName).toBe("Test Product");
			expect(bo.customerId).toBe("cust_1");
			expect(bo.customerEmail).toBe("alice@example.com");
			expect(bo.quantity).toBe(1);
			expect(bo.status).toBe("pending");
			expect(bo.createdAt).toBeInstanceOf(Date);
			expect(bo.updatedAt).toBeInstanceOf(Date);
		});

		it("stores optional variant fields", async () => {
			const bo = await mustCreate({
				variantId: "var_xl",
				variantLabel: "XL / Red",
			});
			expect(bo.variantId).toBe("var_xl");
			expect(bo.variantLabel).toBe("XL / Red");
		});

		it("stores optional orderId and notes", async () => {
			const bo = await mustCreate({
				orderId: "ord_123",
				notes: "Rush order",
			});
			expect(bo.orderId).toBe("ord_123");
			expect(bo.notes).toBe("Rush order");
		});

		it("returns null when policy is disabled", async () => {
			await controller.setPolicy({
				productId: "prod_1",
				enabled: false,
				autoConfirm: false,
			});
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(bo).toBeNull();
		});

		it("auto-confirms when policy has autoConfirm", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo = await mustCreate();
			expect(bo.status).toBe("confirmed");
		});

		it("sets estimated date from policy leadDays", async () => {
			await enablePolicy("prod_1", { estimatedLeadDays: 14 });
			const bo = await mustCreate();
			expect(bo.estimatedAvailableAt).toBeInstanceOf(Date);
			const etaTime = bo.estimatedAvailableAt?.getTime() ?? 0;
			const diff = etaTime - bo.createdAt.getTime();
			const days = diff / 86400000;
			expect(days).toBeCloseTo(14, 0);
		});

		it("uses explicit estimatedAvailableAt over policy", async () => {
			await enablePolicy("prod_1", { estimatedLeadDays: 14 });
			const eta = new Date("2026-06-01");
			const bo = await mustCreate({ estimatedAvailableAt: eta });
			expect(bo.estimatedAvailableAt).toEqual(eta);
		});

		it("rejects when quantity exceeds maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 10,
			});
			expect(bo).toBeNull();
		});

		it("allows quantity within maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const bo = await mustCreate({ quantity: 3 });
			expect(bo).not.toBeNull();
		});

		it("rejects when total backorders would exceed maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			await mustCreate({ quantity: 3 });
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 3,
			});
			expect(bo).toBeNull();
		});

		it("allows backorder within total capacity", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 3 });
			const bo = await mustCreate({
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(bo).not.toBeNull();
		});

		it("excludes cancelled backorders from total count", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const first = await mustCreate({ quantity: 4 });
			await controller.cancelBackorder(first.id);
			const second = await mustCreate({
				quantity: 4,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(second).not.toBeNull();
		});
	});

	// ── getBackorder ─────────────────────────────────────────────────────

	describe("getBackorder", () => {
		it("returns existing backorder", async () => {
			const created = await mustCreate();
			const found = await controller.getBackorder(created.id);
			expect(found).not.toBeNull();
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getBackorder("missing");
			expect(found).toBeNull();
		});
	});

	// ── listBackorders ───────────────────────────────────────────────────

	describe("listBackorders", () => {
		it("lists all backorders", async () => {
			await mustCreate();
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const all = await controller.listBackorders();
			expect(all).toHaveLength(2);
		});

		it("filters by productId", async () => {
			await mustCreate();
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
			});
			const result = await controller.listBackorders({
				productId: "prod_1",
			});
			expect(result).toHaveLength(1);
			expect(result[0].productId).toBe("prod_1");
		});

		it("filters by customerId", async () => {
			await mustCreate();
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.listBackorders({
				customerId: "cust_1",
			});
			expect(result).toHaveLength(1);
		});

		it("filters by status", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await mustCreate();
			await controller.createBackorder({
				productId: "prod_2",
				productName: "Other",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 1,
			});
			const pending = await controller.listBackorders({
				status: "pending",
			});
			expect(pending).toHaveLength(1);
			expect(pending[0].productId).toBe("prod_2");

			const confirmed = await controller.listBackorders({
				status: "confirmed",
			});
			expect(confirmed).toHaveLength(1);
			expect(confirmed[0].productId).toBe("prod_1");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await mustCreate({
					customerId: `cust_${i}`,
					customerEmail: `user${i}@example.com`,
				});
			}
			const page = await controller.listBackorders({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no backorders", async () => {
			const result = await controller.listBackorders();
			expect(result).toHaveLength(0);
		});
	});

	// ── countByProduct ───────────────────────────────────────────────────

	describe("countByProduct", () => {
		it("counts active backorders for a product", async () => {
			await mustCreate();
			await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(2);
		});

		it("excludes cancelled and delivered backorders", async () => {
			const bo1 = await mustCreate();
			await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelBackorder(bo1.id);
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("returns 0 for product with no backorders", async () => {
			const count = await controller.countByProduct("prod_none");
			expect(count).toBe(0);
		});
	});

	// ── updateStatus ─────────────────────────────────────────────────────

	describe("updateStatus", () => {
		it("updates status to confirmed", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "confirmed");
			expect(updated?.status).toBe("confirmed");
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				bo.updatedAt.getTime(),
			);
		});

		it("sets allocatedAt when moving to allocated", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "allocated");
			expect(updated?.allocatedAt).toBeInstanceOf(Date);
		});

		it("sets shippedAt when moving to shipped", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "shipped");
			expect(updated?.shippedAt).toBeInstanceOf(Date);
		});

		it("sets cancelledAt and reason when cancelling", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(
				bo.id,
				"cancelled",
				"Out of season",
			);
			expect(updated?.cancelledAt).toBeInstanceOf(Date);
			expect(updated?.cancelReason).toBe("Out of season");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.updateStatus("missing", "confirmed");
			expect(result).toBeNull();
		});
	});

	// ── bulkUpdateStatus ─────────────────────────────────────────────────

	describe("bulkUpdateStatus", () => {
		it("updates multiple backorders at once", async () => {
			const bo1 = await mustCreate();
			const bo2 = await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.bulkUpdateStatus(
				[bo1.id, bo2.id],
				"confirmed",
			);
			expect(result.updated).toBe(2);

			const found1 = await controller.getBackorder(bo1.id);
			const found2 = await controller.getBackorder(bo2.id);
			expect(found1?.status).toBe("confirmed");
			expect(found2?.status).toBe("confirmed");
		});

		it("skips non-existent ids", async () => {
			const bo = await mustCreate();
			const result = await controller.bulkUpdateStatus(
				[bo.id, "missing"],
				"confirmed",
			);
			expect(result.updated).toBe(1);
		});

		it("sets timestamp fields on bulk status change", async () => {
			const bo = await mustCreate();
			await controller.bulkUpdateStatus([bo.id], "shipped");
			const found = await controller.getBackorder(bo.id);
			expect(found?.shippedAt).toBeInstanceOf(Date);
		});
	});

	// ── allocateStock ────────────────────────────────────────────────────

	describe("allocateStock", () => {
		it("allocates stock to confirmed backorders FIFO", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo1 = await mustCreate({ quantity: 2 });
			const bo2 = await mustCreate({
				quantity: 3,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.allocateStock("prod_1", 5);
			expect(result.allocated).toBe(2);
			expect(result.backorderIds).toContain(bo1.id);
			expect(result.backorderIds).toContain(bo2.id);

			const found1 = await controller.getBackorder(bo1.id);
			expect(found1?.status).toBe("allocated");
			expect(found1?.allocatedAt).toBeInstanceOf(Date);
		});

		it("partially allocates when stock is insufficient", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await mustCreate({ quantity: 2 });
			await mustCreate({
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.allocateStock("prod_1", 3);
			expect(result.allocated).toBe(1);
		});

		it("skips pending backorders (only allocates confirmed)", async () => {
			const bo = await mustCreate({ quantity: 1 });
			expect(bo.status).toBe("pending");
			const result = await controller.allocateStock("prod_1", 10);
			expect(result.allocated).toBe(0);
		});

		it("returns empty when no confirmed backorders exist", async () => {
			const result = await controller.allocateStock("prod_1", 10);
			expect(result.allocated).toBe(0);
			expect(result.backorderIds).toHaveLength(0);
		});
	});

	// ── cancelBackorder ──────────────────────────────────────────────────

	describe("cancelBackorder", () => {
		it("cancels a pending backorder", async () => {
			const bo = await mustCreate();
			const cancelled = await controller.cancelBackorder(bo.id, "Changed mind");
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled?.cancelReason).toBe("Changed mind");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.cancelBackorder("missing");
			expect(result).toBeNull();
		});

		it("returns existing backorder if already cancelled", async () => {
			const bo = await mustCreate();
			await controller.cancelBackorder(bo.id);
			const second = await controller.cancelBackorder(bo.id);
			expect(second?.status).toBe("cancelled");
		});

		it("returns existing backorder if already delivered", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "delivered");
			const result = await controller.cancelBackorder(bo.id);
			expect(result?.status).toBe("delivered");
		});

		it("cancels without reason", async () => {
			const bo = await mustCreate();
			const cancelled = await controller.cancelBackorder(bo.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelReason).toBeUndefined();
		});
	});

	// ── getCustomerBackorders ────────────────────────────────────────────

	describe("getCustomerBackorders", () => {
		it("lists backorders for a specific customer", async () => {
			await mustCreate();
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
			});
			await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.getCustomerBackorders("cust_1");
			expect(result).toHaveLength(2);
		});

		it("returns empty array for customer with no backorders", async () => {
			const result = await controller.getCustomerBackorders("cust_none");
			expect(result).toHaveLength(0);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await mustCreate({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page = await controller.getCustomerBackorders("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Policy management ────────────────────────────────────────────────

	describe("setPolicy", () => {
		it("creates a new policy", async () => {
			const policy = await enablePolicy("prod_1", {
				maxQuantityPerOrder: 10,
				estimatedLeadDays: 7,
				message: "Ships in 1 week",
			});
			expect(policy.productId).toBe("prod_1");
			expect(policy.enabled).toBe(true);
			expect(policy.maxQuantityPerOrder).toBe(10);
			expect(policy.estimatedLeadDays).toBe(7);
			expect(policy.message).toBe("Ships in 1 week");
			expect(policy.autoConfirm).toBe(false);
			expect(policy.createdAt).toBeInstanceOf(Date);
		});

		it("updates an existing policy", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const updated = await enablePolicy("prod_1", {
				maxQuantityPerOrder: 20,
			});
			expect(updated.maxQuantityPerOrder).toBe(20);
		});

		it("preserves createdAt on update", async () => {
			const original = await enablePolicy("prod_1");
			const updated = await enablePolicy("prod_1", {
				maxQuantityPerOrder: 20,
			});
			expect(updated.createdAt.getTime()).toBe(original.createdAt.getTime());
		});
	});

	describe("getPolicy", () => {
		it("returns existing policy", async () => {
			await enablePolicy("prod_1");
			const found = await controller.getPolicy("prod_1");
			expect(found).not.toBeNull();
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null for product without policy", async () => {
			const found = await controller.getPolicy("prod_none");
			expect(found).toBeNull();
		});
	});

	describe("listPolicies", () => {
		it("lists all policies", async () => {
			await enablePolicy("prod_1");
			await enablePolicy("prod_2");
			const policies = await controller.listPolicies();
			expect(policies).toHaveLength(2);
		});

		it("filters by enabled status", async () => {
			await enablePolicy("prod_1");
			await controller.setPolicy({
				productId: "prod_2",
				enabled: false,
				autoConfirm: false,
			});
			const enabled = await controller.listPolicies({ enabled: true });
			expect(enabled).toHaveLength(1);
			expect(enabled[0].productId).toBe("prod_1");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await enablePolicy(`prod_${i}`);
			}
			const page = await controller.listPolicies({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("deletePolicy", () => {
		it("deletes an existing policy", async () => {
			await enablePolicy("prod_1");
			const result = await controller.deletePolicy("prod_1");
			expect(result).toBe(true);
			const found = await controller.getPolicy("prod_1");
			expect(found).toBeNull();
		});

		it("returns false for non-existent policy", async () => {
			const result = await controller.deletePolicy("prod_none");
			expect(result).toBe(false);
		});
	});

	// ── checkEligibility ─────────────────────────────────────────────────

	describe("checkEligibility", () => {
		it("returns not eligible when no policy exists", async () => {
			const result = await controller.checkEligibility("prod_1", 1);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Backorders not available");
		});

		it("returns not eligible when policy is disabled", async () => {
			await controller.setPolicy({
				productId: "prod_1",
				enabled: false,
				autoConfirm: false,
			});
			const result = await controller.checkEligibility("prod_1", 1);
			expect(result.eligible).toBe(false);
		});

		it("returns eligible with lead days and message", async () => {
			await enablePolicy("prod_1", {
				estimatedLeadDays: 14,
				message: "Arrives in 2 weeks",
			});
			const result = await controller.checkEligibility("prod_1", 1);
			expect(result.eligible).toBe(true);
			expect(result.estimatedLeadDays).toBe(14);
			expect(result.message).toBe("Arrives in 2 weeks");
		});

		it("rejects when quantity exceeds per-order max", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 3 });
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Maximum 3 per order");
		});

		it("rejects when total capacity would be exceeded", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			await mustCreate({ quantity: 4 });
			const result = await controller.checkEligibility("prod_1", 3);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Backorder capacity reached");
		});

		it("allows when within total capacity", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 3 });
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(true);
		});
	});

	// ── getSummary ───────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns summary with all status counts", async () => {
			await mustCreate();
			const bo2 = await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const bo3 = await mustCreate({
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});
			await controller.updateStatus(bo2.id, "confirmed");
			await controller.updateStatus(bo3.id, "shipped");

			const summary = await controller.getSummary();
			expect(summary.totalPending).toBe(1);
			expect(summary.totalConfirmed).toBe(1);
			expect(summary.totalShipped).toBe(1);
			expect(summary.totalAllocated).toBe(0);
			expect(summary.totalDelivered).toBe(0);
			expect(summary.totalCancelled).toBe(0);
		});

		it("returns empty summary when no backorders", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalPending).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("top products only counts active statuses", async () => {
			const bo1 = await mustCreate();
			await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelBackorder(bo1.id);

			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(1);
			expect(summary.topProducts[0].count).toBe(1);
		});

		it("ranks top products by count descending", async () => {
			for (let i = 0; i < 3; i++) {
				await mustCreate({
					customerId: `cust_a${i}`,
					customerEmail: `a${i}@example.com`,
				});
			}
			await mustCreate({
				productId: "prod_2",
				productName: "Less Popular",
				customerId: "cust_b",
				customerEmail: "b@example.com",
			});

			const summary = await controller.getSummary();
			expect(summary.topProducts[0].productId).toBe("prod_1");
			expect(summary.topProducts[0].count).toBe(3);
			expect(summary.topProducts[1].productId).toBe("prod_2");
			expect(summary.topProducts[1].count).toBe(1);
		});

		it("limits top products to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await mustCreate({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					customerId: `cust_${i}`,
					customerEmail: `user${i}@example.com`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
		});
	});

	// ── Full lifecycle ───────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("pending → confirmed → allocated → shipped → delivered", async () => {
			const bo = await mustCreate();
			expect(bo.status).toBe("pending");

			const confirmed = await controller.updateStatus(bo.id, "confirmed");
			expect(confirmed?.status).toBe("confirmed");

			const allocated = await controller.updateStatus(bo.id, "allocated");
			expect(allocated?.status).toBe("allocated");
			expect(allocated?.allocatedAt).toBeInstanceOf(Date);

			const shipped = await controller.updateStatus(bo.id, "shipped");
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.shippedAt).toBeInstanceOf(Date);

			const delivered = await controller.updateStatus(bo.id, "delivered");
			expect(delivered?.status).toBe("delivered");
		});

		it("auto-confirm + allocate flow", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo = await mustCreate({ quantity: 2 });
			expect(bo.status).toBe("confirmed");

			const result = await controller.allocateStock("prod_1", 5);
			expect(result.allocated).toBe(1);
			expect(result.backorderIds).toContain(bo.id);

			const found = await controller.getBackorder(bo.id);
			expect(found?.status).toBe("allocated");
		});
	});
});
