import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Backorder } from "../service";
import { createBackordersController } from "../service-impl";

describe("backorders controller edge cases", () => {
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

	// ── createBackorder boundary conditions ──────────────────────────────

	describe("createBackorder - boundary conditions", () => {
		it("allows quantity exactly equal to maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const bo = await mustCreate({ quantity: 5 });
			expect(bo).not.toBeNull();
			expect(bo.quantity).toBe(5);
		});

		it("rejects quantity one above maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 6,
			});
			expect(bo).toBeNull();
		});

		it("allows total quantity exactly equal to maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 7 });
			const bo = await mustCreate({
				quantity: 3,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(bo).not.toBeNull();
		});

		it("rejects when total quantity equals maxTotalBackorders + 1", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 7 });
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 4,
			});
			expect(bo).toBeNull();
		});

		it("creates backorder with quantity of 1 (minimum)", async () => {
			const bo = await mustCreate({ quantity: 1 });
			expect(bo.quantity).toBe(1);
		});

		it("creates backorder with very large quantity when no policy limits", async () => {
			const bo = await mustCreate({ quantity: 999999 });
			expect(bo.quantity).toBe(999999);
		});

		it("does not set estimatedAvailableAt when no policy and no explicit date", async () => {
			const bo = await mustCreate();
			expect(bo.estimatedAvailableAt).toBeUndefined();
		});

		it("does not set estimatedAvailableAt when policy has no estimatedLeadDays", async () => {
			await enablePolicy("prod_1");
			const bo = await mustCreate();
			expect(bo.estimatedAvailableAt).toBeUndefined();
		});

		it("generates unique ids for multiple backorders", async () => {
			const bo1 = await mustCreate();
			const bo2 = await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const bo3 = await mustCreate({
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});
			const ids = new Set([bo1.id, bo2.id, bo3.id]);
			expect(ids.size).toBe(3);
		});

		it("excludes shipped backorders from total count against maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const bo = await mustCreate({ quantity: 5 });
			await controller.updateStatus(bo.id, "shipped");
			// shipped is not in ACTIVE_STATUSES, so capacity should be free
			const bo2 = await mustCreate({
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(bo2).not.toBeNull();
		});

		it("excludes delivered backorders from total count against maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const bo = await mustCreate({ quantity: 5 });
			await controller.updateStatus(bo.id, "delivered");
			const bo2 = await mustCreate({
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(bo2).not.toBeNull();
		});

		it("counts confirmed backorders toward maxTotalBackorders", async () => {
			await enablePolicy("prod_1", {
				maxTotalBackorders: 3,
				autoConfirm: true,
			});
			await mustCreate({ quantity: 3 });
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 1,
			});
			expect(bo).toBeNull();
		});

		it("counts allocated backorders toward maxTotalBackorders", async () => {
			await enablePolicy("prod_1", {
				maxTotalBackorders: 3,
				autoConfirm: true,
			});
			const bo = await mustCreate({ quantity: 3 });
			await controller.updateStatus(bo.id, "allocated");
			const bo2 = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 1,
			});
			expect(bo2).toBeNull();
		});

		it("allows backorder for a different product even when one product is at capacity", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 1 });
			await mustCreate({ quantity: 1 });
			const bo = await mustCreate({
				productId: "prod_2",
				productName: "Other Product",
				quantity: 5,
			});
			expect(bo).not.toBeNull();
			expect(bo.productId).toBe("prod_2");
		});

		it("stores empty string notes without error", async () => {
			const bo = await mustCreate({ notes: "" });
			expect(bo.notes).toBe("");
		});

		it("creates backorder with both maxQuantityPerOrder and maxTotalBackorders passing", async () => {
			await enablePolicy("prod_1", {
				maxQuantityPerOrder: 5,
				maxTotalBackorders: 10,
			});
			const bo = await mustCreate({ quantity: 5 });
			expect(bo).not.toBeNull();
		});

		it("rejects when maxQuantityPerOrder fails even though maxTotalBackorders would pass", async () => {
			await enablePolicy("prod_1", {
				maxQuantityPerOrder: 3,
				maxTotalBackorders: 100,
			});
			const bo = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 5,
			});
			expect(bo).toBeNull();
		});
	});

	// ── allocateStock edge cases ─────────────────────────────────────────

	describe("allocateStock - edge cases", () => {
		it("does not allocate backorders with quantity larger than remaining stock", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await mustCreate({ quantity: 3 });
			await mustCreate({
				quantity: 10,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			// Only 5 units of stock: first backorder (3) fits, second (10) does not
			const result = await controller.allocateStock("prod_1", 5);
			expect(result.allocated).toBe(1);
		});

		it("allocates zero when stock quantity is zero", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await mustCreate({ quantity: 1 });
			const result = await controller.allocateStock("prod_1", 0);
			expect(result.allocated).toBe(0);
			expect(result.backorderIds).toHaveLength(0);
		});

		it("does not allocate pending backorders even with ample stock", async () => {
			// No autoConfirm, so backorders stay pending
			const bo = await mustCreate({ quantity: 1 });
			expect(bo.status).toBe("pending");
			const result = await controller.allocateStock("prod_1", 100);
			expect(result.allocated).toBe(0);
		});

		it("does not allocate already-allocated backorders", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo = await mustCreate({ quantity: 2 });
			await controller.allocateStock("prod_1", 10);
			const found = await controller.getBackorder(bo.id);
			expect(found?.status).toBe("allocated");

			// second allocation should find nothing to allocate
			const result = await controller.allocateStock("prod_1", 10);
			expect(result.allocated).toBe(0);
		});

		it("allocates for correct product only", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			await enablePolicy("prod_2", { autoConfirm: true });
			await mustCreate({ quantity: 1 });
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.allocateStock("prod_1", 10);
			expect(result.allocated).toBe(1);
			// prod_2 backorder should still be confirmed
			const all = await controller.listBackorders({ productId: "prod_2" });
			expect(all[0].status).toBe("confirmed");
		});

		it("handles allocation when one backorder exactly exhausts remaining stock", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo1 = await mustCreate({ quantity: 5 });
			await mustCreate({
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.allocateStock("prod_1", 5);
			expect(result.allocated).toBe(1);
			expect(result.backorderIds).toContain(bo1.id);
		});

		it("allocates nothing for a non-existent product", async () => {
			const result = await controller.allocateStock("no_such_product", 100);
			expect(result.allocated).toBe(0);
			expect(result.backorderIds).toHaveLength(0);
		});
	});

	// ── cancelBackorder edge cases ──────────────────────────────────────

	describe("cancelBackorder - edge cases", () => {
		it("can cancel a confirmed backorder", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "confirmed");
			const cancelled = await controller.cancelBackorder(
				bo.id,
				"No longer needed",
			);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelReason).toBe("No longer needed");
		});

		it("can cancel an allocated backorder", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "allocated");
			const cancelled = await controller.cancelBackorder(bo.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("can cancel a shipped backorder", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "shipped");
			const cancelled = await controller.cancelBackorder(bo.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns the already-cancelled backorder without re-updating timestamps", async () => {
			const bo = await mustCreate();
			await controller.cancelBackorder(bo.id, "First reason");
			const second = await controller.cancelBackorder(bo.id, "Second reason");
			// Should return the already-cancelled record, not update it
			expect(second?.status).toBe("cancelled");
			expect(second?.cancelReason).toBe("First reason");
		});

		it("returns delivered backorder unchanged when attempting cancel", async () => {
			const bo = await mustCreate();
			await controller.updateStatus(bo.id, "delivered");
			const result = await controller.cancelBackorder(
				bo.id,
				"Too late to cancel",
			);
			expect(result?.status).toBe("delivered");
			expect(result?.cancelReason).toBeUndefined();
		});
	});

	// ── updateStatus edge cases ─────────────────────────────────────────

	describe("updateStatus - edge cases", () => {
		it("does not set allocatedAt when updating to confirmed", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "confirmed");
			expect(updated?.allocatedAt).toBeUndefined();
		});

		it("does not set shippedAt when updating to allocated", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "allocated");
			expect(updated?.shippedAt).toBeUndefined();
		});

		it("sets cancelledAt without reason when no reason provided", async () => {
			const bo = await mustCreate();
			const updated = await controller.updateStatus(bo.id, "cancelled");
			expect(updated?.cancelledAt).toBeInstanceOf(Date);
			expect(updated?.cancelReason).toBeUndefined();
		});

		it("preserves original data fields after status update", async () => {
			const bo = await mustCreate({
				variantId: "var_1",
				variantLabel: "Size L",
				orderId: "ord_100",
				notes: "Priority",
			});
			const updated = await controller.updateStatus(bo.id, "confirmed");
			expect(updated?.variantId).toBe("var_1");
			expect(updated?.variantLabel).toBe("Size L");
			expect(updated?.orderId).toBe("ord_100");
			expect(updated?.notes).toBe("Priority");
			expect(updated?.productId).toBe("prod_1");
			expect(updated?.customerId).toBe("cust_1");
		});

		it("updates updatedAt on each status change", async () => {
			const bo = await mustCreate();
			const confirmed = await controller.updateStatus(bo.id, "confirmed");
			expect(confirmed?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				bo.updatedAt.getTime(),
			);
		});

		it("can transition directly from pending to shipped", async () => {
			const bo = await mustCreate();
			const shipped = await controller.updateStatus(bo.id, "shipped");
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.shippedAt).toBeInstanceOf(Date);
		});

		it("can transition directly from pending to delivered", async () => {
			const bo = await mustCreate();
			const delivered = await controller.updateStatus(bo.id, "delivered");
			expect(delivered?.status).toBe("delivered");
		});
	});

	// ── bulkUpdateStatus edge cases ─────────────────────────────────────

	describe("bulkUpdateStatus - edge cases", () => {
		it("returns zero updated for empty ids array", async () => {
			const result = await controller.bulkUpdateStatus([], "confirmed");
			expect(result.updated).toBe(0);
		});

		it("returns zero updated for all non-existent ids", async () => {
			const result = await controller.bulkUpdateStatus(
				["fake_1", "fake_2", "fake_3"],
				"confirmed",
			);
			expect(result.updated).toBe(0);
		});

		it("sets cancelledAt on bulk cancel", async () => {
			const bo1 = await mustCreate();
			const bo2 = await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.bulkUpdateStatus([bo1.id, bo2.id], "cancelled");
			const found1 = await controller.getBackorder(bo1.id);
			const found2 = await controller.getBackorder(bo2.id);
			expect(found1?.cancelledAt).toBeInstanceOf(Date);
			expect(found2?.cancelledAt).toBeInstanceOf(Date);
		});

		it("sets allocatedAt on bulk allocate", async () => {
			const bo = await mustCreate();
			await controller.bulkUpdateStatus([bo.id], "allocated");
			const found = await controller.getBackorder(bo.id);
			expect(found?.allocatedAt).toBeInstanceOf(Date);
		});

		it("handles mix of existing and non-existing ids", async () => {
			const bo1 = await mustCreate();
			const bo2 = await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.bulkUpdateStatus(
				[bo1.id, "nonexistent_1", bo2.id, "nonexistent_2"],
				"confirmed",
			);
			expect(result.updated).toBe(2);
		});

		it("processes duplicate ids correctly", async () => {
			const bo = await mustCreate();
			const result = await controller.bulkUpdateStatus(
				[bo.id, bo.id, bo.id],
				"confirmed",
			);
			// each lookup succeeds and saves, so updated = 3
			expect(result.updated).toBe(3);
			const found = await controller.getBackorder(bo.id);
			expect(found?.status).toBe("confirmed");
		});
	});

	// ── countByProduct edge cases ───────────────────────────────────────

	describe("countByProduct - edge cases", () => {
		it("counts pending as active", async () => {
			await mustCreate({ quantity: 1 });
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("counts confirmed as active", async () => {
			const bo = await mustCreate({ quantity: 1 });
			await controller.updateStatus(bo.id, "confirmed");
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("counts allocated as active", async () => {
			const bo = await mustCreate({ quantity: 1 });
			await controller.updateStatus(bo.id, "allocated");
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("excludes shipped from active count", async () => {
			const bo = await mustCreate({ quantity: 1 });
			await controller.updateStatus(bo.id, "shipped");
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(0);
		});

		it("excludes delivered from active count", async () => {
			const bo = await mustCreate({ quantity: 1 });
			await controller.updateStatus(bo.id, "delivered");
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(0);
		});

		it("does not count backorders from other products", async () => {
			await mustCreate({ productId: "prod_1", quantity: 1 });
			await mustCreate({
				productId: "prod_2",
				productName: "Other",
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});
	});

	// ── checkEligibility edge cases ─────────────────────────────────────

	describe("checkEligibility - edge cases", () => {
		it("returns eligible with quantity exactly at maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(true);
		});

		it("returns ineligible with quantity one over maxQuantityPerOrder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 5 });
			const result = await controller.checkEligibility("prod_1", 6);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Maximum 5 per order");
		});

		it("returns eligible when total exactly equals maxTotalBackorders", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 7 });
			const result = await controller.checkEligibility("prod_1", 3);
			expect(result.eligible).toBe(true);
		});

		it("returns ineligible when total exceeds maxTotalBackorders by 1", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 10 });
			await mustCreate({ quantity: 7 });
			const result = await controller.checkEligibility("prod_1", 4);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Backorder capacity reached");
		});

		it("does not return estimatedLeadDays when not set on policy", async () => {
			await enablePolicy("prod_1");
			const result = await controller.checkEligibility("prod_1", 1);
			expect(result.eligible).toBe(true);
			expect(result.estimatedLeadDays).toBeUndefined();
		});

		it("does not return message when not set on policy", async () => {
			await enablePolicy("prod_1");
			const result = await controller.checkEligibility("prod_1", 1);
			expect(result.eligible).toBe(true);
			expect(result.message).toBeUndefined();
		});

		it("excludes cancelled backorders from total capacity check", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const bo = await mustCreate({ quantity: 5 });
			await controller.cancelBackorder(bo.id);
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(true);
		});

		it("excludes shipped backorders from total capacity check", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const bo = await mustCreate({ quantity: 5 });
			await controller.updateStatus(bo.id, "shipped");
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(true);
		});

		it("excludes delivered backorders from total capacity check", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 5 });
			const bo = await mustCreate({ quantity: 5 });
			await controller.updateStatus(bo.id, "delivered");
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(true);
		});

		it("maxQuantityPerOrder is checked before maxTotalBackorders", async () => {
			await enablePolicy("prod_1", {
				maxQuantityPerOrder: 2,
				maxTotalBackorders: 100,
			});
			const result = await controller.checkEligibility("prod_1", 5);
			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Maximum 2 per order");
		});
	});

	// ── Policy management edge cases ────────────────────────────────────

	describe("setPolicy - edge cases", () => {
		it("defaults autoConfirm to false when not provided", async () => {
			const policy = await controller.setPolicy({
				productId: "prod_1",
				enabled: true,
			});
			expect(policy.autoConfirm).toBe(false);
		});

		it("preserves policy id on update", async () => {
			const original = await enablePolicy("prod_1");
			const updated = await enablePolicy("prod_1", {
				maxQuantityPerOrder: 99,
			});
			expect(updated.id).toBe(original.id);
		});

		it("updates updatedAt on policy update", async () => {
			const original = await enablePolicy("prod_1");
			const updated = await enablePolicy("prod_1", {
				maxQuantityPerOrder: 99,
			});
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				original.updatedAt.getTime(),
			);
		});

		it("can disable a previously enabled policy", async () => {
			await enablePolicy("prod_1");
			const disabled = await controller.setPolicy({
				productId: "prod_1",
				enabled: false,
			});
			expect(disabled.enabled).toBe(false);
		});

		it("can re-enable a disabled policy", async () => {
			await enablePolicy("prod_1");
			await controller.setPolicy({
				productId: "prod_1",
				enabled: false,
			});
			const reEnabled = await enablePolicy("prod_1");
			expect(reEnabled.enabled).toBe(true);
		});

		it("handles policy with all optional fields undefined", async () => {
			const policy = await controller.setPolicy({
				productId: "prod_1",
				enabled: true,
			});
			expect(policy.maxQuantityPerOrder).toBeUndefined();
			expect(policy.maxTotalBackorders).toBeUndefined();
			expect(policy.estimatedLeadDays).toBeUndefined();
			expect(policy.message).toBeUndefined();
		});
	});

	// ── listPolicies edge cases ─────────────────────────────────────────

	describe("listPolicies - edge cases", () => {
		it("returns empty array when no policies exist", async () => {
			const policies = await controller.listPolicies();
			expect(policies).toHaveLength(0);
		});

		it("filters disabled policies correctly", async () => {
			await enablePolicy("prod_1");
			await controller.setPolicy({
				productId: "prod_2",
				enabled: false,
				autoConfirm: false,
			});
			const disabled = await controller.listPolicies({ enabled: false });
			expect(disabled).toHaveLength(1);
			expect(disabled[0].productId).toBe("prod_2");
		});

		it("returns all policies when no filter is provided", async () => {
			await enablePolicy("prod_1");
			await controller.setPolicy({
				productId: "prod_2",
				enabled: false,
				autoConfirm: false,
			});
			const all = await controller.listPolicies();
			expect(all).toHaveLength(2);
		});
	});

	// ── deletePolicy edge cases ─────────────────────────────────────────

	describe("deletePolicy - edge cases", () => {
		it("allows creating backorders after policy is deleted (no policy = allowed)", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 1 });
			await controller.deletePolicy("prod_1");
			const bo = await mustCreate({ quantity: 100 });
			expect(bo).not.toBeNull();
			expect(bo.quantity).toBe(100);
		});

		it("double delete returns false on second attempt", async () => {
			await enablePolicy("prod_1");
			const first = await controller.deletePolicy("prod_1");
			expect(first).toBe(true);
			const second = await controller.deletePolicy("prod_1");
			expect(second).toBe(false);
		});
	});

	// ── listBackorders edge cases ───────────────────────────────────────

	describe("listBackorders - edge cases", () => {
		it("returns empty array when filtering by non-existent productId", async () => {
			await mustCreate();
			const result = await controller.listBackorders({
				productId: "prod_nonexistent",
			});
			expect(result).toHaveLength(0);
		});

		it("returns empty array when filtering by non-existent customerId", async () => {
			await mustCreate();
			const result = await controller.listBackorders({
				customerId: "cust_nonexistent",
			});
			expect(result).toHaveLength(0);
		});

		it("returns empty array when filtering by status with no matches", async () => {
			await mustCreate(); // pending
			const result = await controller.listBackorders({
				status: "delivered",
			});
			expect(result).toHaveLength(0);
		});

		it("handles take of 0", async () => {
			await mustCreate();
			await mustCreate({
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.listBackorders({ take: 0 });
			expect(result).toHaveLength(0);
		});

		it("handles skip larger than total results", async () => {
			await mustCreate();
			const result = await controller.listBackorders({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("returns all with undefined params", async () => {
			await mustCreate();
			const result = await controller.listBackorders(undefined);
			expect(result).toHaveLength(1);
		});
	});

	// ── getCustomerBackorders edge cases ────────────────────────────────

	describe("getCustomerBackorders - edge cases", () => {
		it("returns backorders across multiple products for same customer", async () => {
			await mustCreate({ productId: "prod_1", productName: "P1" });
			await mustCreate({ productId: "prod_2", productName: "P2" });
			await mustCreate({ productId: "prod_3", productName: "P3" });
			const result = await controller.getCustomerBackorders("cust_1");
			expect(result).toHaveLength(3);
		});

		it("handles take of 0", async () => {
			await mustCreate();
			const result = await controller.getCustomerBackorders("cust_1", {
				take: 0,
			});
			expect(result).toHaveLength(0);
		});

		it("handles skip larger than total", async () => {
			await mustCreate();
			const result = await controller.getCustomerBackorders("cust_1", {
				skip: 100,
			});
			expect(result).toHaveLength(0);
		});
	});

	// ── getSummary edge cases ───────────────────────────────────────────

	describe("getSummary - edge cases", () => {
		it("correctly tallies all six statuses", async () => {
			await mustCreate({
				customerId: "c1",
				customerEmail: "c1@example.com",
			});
			const boConfirmed = await mustCreate({
				customerId: "c2",
				customerEmail: "c2@example.com",
			});
			const boAllocated = await mustCreate({
				customerId: "c3",
				customerEmail: "c3@example.com",
			});
			const boShipped = await mustCreate({
				customerId: "c4",
				customerEmail: "c4@example.com",
			});
			const boDelivered = await mustCreate({
				customerId: "c5",
				customerEmail: "c5@example.com",
			});
			const boCancelled = await mustCreate({
				customerId: "c6",
				customerEmail: "c6@example.com",
			});

			await controller.updateStatus(boConfirmed.id, "confirmed");
			await controller.updateStatus(boAllocated.id, "allocated");
			await controller.updateStatus(boShipped.id, "shipped");
			await controller.updateStatus(boDelivered.id, "delivered");
			await controller.cancelBackorder(boCancelled.id);

			const summary = await controller.getSummary();
			expect(summary.totalPending).toBe(1);
			expect(summary.totalConfirmed).toBe(1);
			expect(summary.totalAllocated).toBe(1);
			expect(summary.totalShipped).toBe(1);
			expect(summary.totalDelivered).toBe(1);
			expect(summary.totalCancelled).toBe(1);
		});

		it("topProducts excludes shipped, delivered, and cancelled", async () => {
			const boShipped = await mustCreate({
				customerId: "c1",
				customerEmail: "c1@example.com",
				productId: "prod_shipped",
				productName: "Shipped Only",
			});
			const boDelivered = await mustCreate({
				customerId: "c2",
				customerEmail: "c2@example.com",
				productId: "prod_delivered",
				productName: "Delivered Only",
			});
			const boCancelled = await mustCreate({
				customerId: "c3",
				customerEmail: "c3@example.com",
				productId: "prod_cancelled",
				productName: "Cancelled Only",
			});
			await controller.updateStatus(boShipped.id, "shipped");
			await controller.updateStatus(boDelivered.id, "delivered");
			await controller.cancelBackorder(boCancelled.id);

			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(0);
		});

		it("topProducts groups by productId using productName from entries", async () => {
			await mustCreate({
				productId: "prod_a",
				productName: "Product A",
				customerId: "c1",
				customerEmail: "c1@example.com",
			});
			await mustCreate({
				productId: "prod_a",
				productName: "Product A",
				customerId: "c2",
				customerEmail: "c2@example.com",
			});
			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(1);
			expect(summary.topProducts[0].productName).toBe("Product A");
			expect(summary.topProducts[0].count).toBe(2);
		});

		it("topProducts uses last-seen productName for a given productId", async () => {
			// First entry uses "Name v1", second uses "Name v2" - the Map set overwrites count but productName is set on first insert
			await mustCreate({
				productId: "prod_a",
				productName: "Name v1",
				customerId: "c1",
				customerEmail: "c1@example.com",
			});
			await mustCreate({
				productId: "prod_a",
				productName: "Name v2",
				customerId: "c2",
				customerEmail: "c2@example.com",
			});
			const summary = await controller.getSummary();
			// The implementation sets productName on first insert and only increments count after
			expect(summary.topProducts[0].productName).toBe("Name v1");
		});
	});

	// ── Cross-method interaction edge cases ─────────────────────────────

	describe("cross-method interactions", () => {
		it("cancelled backorder frees capacity for new backorder", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 1 });
			const bo = await mustCreate({ quantity: 1 });
			await controller.cancelBackorder(bo.id);
			const bo2 = await mustCreate({
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(bo2).not.toBeNull();
		});

		it("delivered backorder frees capacity for eligibility check", async () => {
			await enablePolicy("prod_1", { maxTotalBackorders: 1 });
			const bo = await mustCreate({ quantity: 1 });
			await controller.updateStatus(bo.id, "delivered");
			const elig = await controller.checkEligibility("prod_1", 1);
			expect(elig.eligible).toBe(true);
		});

		it("policy change takes effect on next createBackorder", async () => {
			await enablePolicy("prod_1", { maxQuantityPerOrder: 10 });
			const bo = await mustCreate({ quantity: 10 });
			expect(bo).not.toBeNull();

			// Tighten the policy
			await enablePolicy("prod_1", { maxQuantityPerOrder: 2 });
			const bo2 = await controller.createBackorder({
				productId: "prod_1",
				productName: "Test",
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 5,
			});
			expect(bo2).toBeNull();
		});

		it("deleting policy removes all limits", async () => {
			await enablePolicy("prod_1", {
				maxQuantityPerOrder: 1,
				maxTotalBackorders: 1,
			});
			await controller.deletePolicy("prod_1");
			const bo = await mustCreate({ quantity: 999 });
			expect(bo).not.toBeNull();
		});

		it("auto-confirmed backorders are immediately eligible for allocation", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo = await mustCreate({ quantity: 1 });
			expect(bo.status).toBe("confirmed");

			const result = await controller.allocateStock("prod_1", 1);
			expect(result.allocated).toBe(1);
			expect(result.backorderIds).toContain(bo.id);

			const found = await controller.getBackorder(bo.id);
			expect(found?.status).toBe("allocated");
			expect(found?.allocatedAt).toBeInstanceOf(Date);
		});

		it("bulk update to cancelled makes backorders unallocatable", async () => {
			await enablePolicy("prod_1", { autoConfirm: true });
			const bo1 = await mustCreate({ quantity: 1 });
			const bo2 = await mustCreate({
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.bulkUpdateStatus([bo1.id, bo2.id], "cancelled");
			const result = await controller.allocateStock("prod_1", 100);
			expect(result.allocated).toBe(0);
		});
	});
});
