import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createVendorController } from "../service-impl";

/**
 * Security tests for vendors module endpoints.
 *
 * These tests verify:
 * - Vendor isolation: one vendor cannot access another's products/payouts
 * - Status enforcement: only approved vendors should be active on storefront
 * - Payout security: vendor payouts scoped correctly, status transitions valid
 * - Product assignment isolation: products scoped to their vendor
 * - Cascade deletion: deleting vendor removes products and payouts
 * - Commission integrity: commission rates cannot be manipulated
 */

describe("vendors endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createVendorController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createVendorController(mockData);
	});

	async function createTestVendor(
		slug: string,
		status: "pending" | "active" | "suspended" | "closed" = "active",
	) {
		return controller.createVendor({
			name: `Vendor ${slug}`,
			slug,
			email: `${slug}@vendor.com`,
			commissionRate: 10,
			status,
		});
	}

	// ── Vendor Isolation ────────────────────────────────────────────

	describe("vendor isolation", () => {
		it("vendor products are scoped to the correct vendor", async () => {
			const vendorA = await createTestVendor("vendor-a");
			const vendorB = await createTestVendor("vendor-b");

			await controller.assignProduct({
				vendorId: vendorA.id,
				productId: "prod_1",
			});

			const productsA = await controller.listVendorProducts({
				vendorId: vendorA.id,
			});
			const productsB = await controller.listVendorProducts({
				vendorId: vendorB.id,
			});

			expect(productsA).toHaveLength(1);
			expect(productsB).toHaveLength(0);
		});

		it("vendor payouts are scoped to the correct vendor", async () => {
			const vendorA = await createTestVendor("vendor-a");
			const vendorB = await createTestVendor("vendor-b");

			await controller.createPayout({
				vendorId: vendorA.id,
				amount: 5000,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});

			const payoutsA = await controller.listPayouts({
				vendorId: vendorA.id,
			});
			const payoutsB = await controller.listPayouts({
				vendorId: vendorB.id,
			});

			expect(payoutsA).toHaveLength(1);
			expect(payoutsB).toHaveLength(0);
		});

		it("getProductVendor returns the correct vendor", async () => {
			const vendorA = await createTestVendor("vendor-a");
			await createTestVendor("vendor-b");

			await controller.assignProduct({
				vendorId: vendorA.id,
				productId: "prod_1",
			});

			const result = await controller.getProductVendor("prod_1");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(vendorA.id);
		});

		it("getProductVendor returns null for unassigned product", async () => {
			const result = await controller.getProductVendor("unassigned_prod");
			expect(result).toBeNull();
		});
	});

	// ── Status Enforcement ──────────────────────────────────────────

	describe("status enforcement", () => {
		it("pending vendors are not active on storefront", async () => {
			const pending = await createTestVendor("pending-vendor", "pending");

			expect(pending.status).toBe("pending");

			const vendors = await controller.listVendors({ status: "active" });
			const pendingFound = vendors.some((v) => v.id === pending.id);
			expect(pendingFound).toBe(false);
		});

		it("suspended vendors are not listed as approved", async () => {
			const vendor = await createTestVendor("suspended-vendor");
			await controller.updateVendorStatus(vendor.id, "suspended");

			const approved = await controller.listVendors({ status: "active" });
			const found = approved.some((v) => v.id === vendor.id);
			expect(found).toBe(false);
		});

		it("status transitions are tracked", async () => {
			const vendor = await createTestVendor("transitioning", "pending");

			const activated = await controller.updateVendorStatus(
				vendor.id,
				"active",
			);
			expect(activated?.status).toBe("active");

			const suspended = await controller.updateVendorStatus(
				vendor.id,
				"suspended",
			);
			expect(suspended?.status).toBe("suspended");
		});

		it("status update on non-existent vendor returns null", async () => {
			const result = await controller.updateVendorStatus(
				"nonexistent",
				"active",
			);
			expect(result).toBeNull();
		});
	});

	// ── Payout Security ─────────────────────────────────────────────

	describe("payout security", () => {
		it("payout for non-existent vendor throws error", async () => {
			await expect(
				controller.createPayout({
					vendorId: "nonexistent",
					amount: 5000,
					currency: "USD",
					periodStart: new Date("2026-01-01"),
					periodEnd: new Date("2026-01-31"),
				}),
			).rejects.toThrow();
		});

		it("payout status transitions are valid", async () => {
			const vendor = await createTestVendor("payout-vendor");
			const payout = await controller.createPayout({
				vendorId: vendor.id,
				amount: 5000,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});

			expect(payout.status).toBe("pending");

			const processing = await controller.updatePayoutStatus(
				payout.id,
				"processing",
			);
			expect(processing?.status).toBe("processing");

			const completed = await controller.updatePayoutStatus(
				payout.id,
				"completed",
			);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).not.toBeNull();
		});

		it("payout stats scoped to vendor when vendorId provided", async () => {
			const vendorA = await createTestVendor("vendor-a");
			const vendorB = await createTestVendor("vendor-b");

			await controller.createPayout({
				vendorId: vendorA.id,
				amount: 1000,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});
			await controller.createPayout({
				vendorId: vendorB.id,
				amount: 2000,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});

			const statsA = await controller.getPayoutStats(vendorA.id);
			const statsB = await controller.getPayoutStats(vendorB.id);

			expect(statsA.pendingAmount).toBe(1000);
			expect(statsB.pendingAmount).toBe(2000);
		});

		it("payout status update on non-existent payout returns null", async () => {
			const result = await controller.updatePayoutStatus(
				"nonexistent",
				"completed",
			);
			expect(result).toBeNull();
		});
	});

	// ── Product Assignment Security ─────────────────────────────────

	describe("product assignment security", () => {
		it("assigning same product twice is idempotent", async () => {
			const vendor = await createTestVendor("vendor-a");

			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});

			const products = await controller.listVendorProducts({
				vendorId: vendor.id,
			});
			expect(products).toHaveLength(1);
		});

		it("unassigning product removes it from vendor", async () => {
			const vendor = await createTestVendor("vendor-a");

			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.unassignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});

			const products = await controller.listVendorProducts({
				vendorId: vendor.id,
			});
			expect(products).toHaveLength(0);
		});

		it("unassigning non-existent product returns false", async () => {
			const vendor = await createTestVendor("vendor-a");

			const result = await controller.unassignProduct({
				vendorId: vendor.id,
				productId: "nonexistent",
			});
			expect(result).toBe(false);
		});

		it("commission override is vendor-scoped", async () => {
			const vendorA = await createTestVendor("vendor-a");
			const vendorB = await createTestVendor("vendor-b");

			await controller.assignProduct({
				vendorId: vendorA.id,
				productId: "prod_1",
				commissionOverride: 15,
			});
			await controller.assignProduct({
				vendorId: vendorB.id,
				productId: "prod_2",
				commissionOverride: 20,
			});

			const prodA = await controller.listVendorProducts({
				vendorId: vendorA.id,
			});
			const prodB = await controller.listVendorProducts({
				vendorId: vendorB.id,
			});

			expect(prodA[0].commissionOverride).toBe(15);
			expect(prodB[0].commissionOverride).toBe(20);
		});
	});

	// ── Cascade Deletion ────────────────────────────────────────────

	describe("cascade deletion", () => {
		it("deleting vendor removes its products and payouts", async () => {
			const vendor = await createTestVendor("doomed-vendor");

			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.createPayout({
				vendorId: vendor.id,
				amount: 5000,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});

			await controller.deleteVendor(vendor.id);

			const products = await controller.listVendorProducts({
				vendorId: vendor.id,
			});
			const payouts = await controller.listPayouts({
				vendorId: vendor.id,
			});

			expect(products).toHaveLength(0);
			expect(payouts).toHaveLength(0);
		});

		it("deleting one vendor does not affect another", async () => {
			const vendorA = await createTestVendor("vendor-a");
			const vendorB = await createTestVendor("vendor-b");

			await controller.assignProduct({
				vendorId: vendorA.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: vendorB.id,
				productId: "prod_2",
			});

			await controller.deleteVendor(vendorA.id);

			const productsB = await controller.listVendorProducts({
				vendorId: vendorB.id,
			});
			expect(productsB).toHaveLength(1);
		});

		it("deleting non-existent vendor returns false", async () => {
			const result = await controller.deleteVendor("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Non-existent Resources ──────────────────────────────────────

	describe("non-existent resources", () => {
		it("getVendor returns null for non-existent ID", async () => {
			const result = await controller.getVendor("nonexistent");
			expect(result).toBeNull();
		});

		it("getVendorBySlug returns null for non-existent slug", async () => {
			const result = await controller.getVendorBySlug("nonexistent");
			expect(result).toBeNull();
		});

		it("updateVendor returns null for non-existent ID", async () => {
			const result = await controller.updateVendor("nonexistent", {
				name: "Updated",
			});
			expect(result).toBeNull();
		});

		it("getPayout returns null for non-existent ID", async () => {
			const result = await controller.getPayout("nonexistent");
			expect(result).toBeNull();
		});
	});
});
