import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createVendorController } from "../service-impl";

describe("createVendorController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createVendorController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createVendorController(mockData);
	});

	async function createTestVendor(
		overrides: Partial<Parameters<typeof controller.createVendor>[0]> = {},
	) {
		return controller.createVendor({
			name: "Acme Store",
			slug: "acme",
			email: "vendor@acme.com",
			...overrides,
		});
	}

	async function createTestPayout(vendorId: string) {
		return controller.createPayout({
			vendorId,
			amount: 500,
			currency: "USD",
			periodStart: new Date("2026-01-01"),
			periodEnd: new Date("2026-01-31"),
		});
	}

	// ── createVendor ──

	describe("createVendor", () => {
		it("creates a vendor with required fields", async () => {
			const vendor = await createTestVendor();
			expect(vendor.id).toBeDefined();
			expect(vendor.name).toBe("Acme Store");
			expect(vendor.slug).toBe("acme");
			expect(vendor.email).toBe("vendor@acme.com");
			expect(vendor.commissionRate).toBe(10);
			expect(vendor.status).toBe("pending");
			expect(vendor.joinedAt).toBeInstanceOf(Date);
			expect(vendor.createdAt).toBeInstanceOf(Date);
			expect(vendor.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a vendor with all optional fields", async () => {
			const vendor = await createTestVendor({
				phone: "+1-555-0100",
				description: "Premium supplies",
				logo: "/logos/acme.png",
				banner: "/banners/acme.jpg",
				website: "https://acme.example.com",
				commissionRate: 15,
				status: "active",
				addressLine1: "123 Main St",
				addressLine2: "Suite 100",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
				metadata: { tier: "gold" },
			});
			expect(vendor.phone).toBe("+1-555-0100");
			expect(vendor.description).toBe("Premium supplies");
			expect(vendor.logo).toBe("/logos/acme.png");
			expect(vendor.banner).toBe("/banners/acme.jpg");
			expect(vendor.website).toBe("https://acme.example.com");
			expect(vendor.commissionRate).toBe(15);
			expect(vendor.status).toBe("active");
			expect(vendor.addressLine1).toBe("123 Main St");
			expect(vendor.addressLine2).toBe("Suite 100");
			expect(vendor.city).toBe("Springfield");
			expect(vendor.state).toBe("IL");
			expect(vendor.postalCode).toBe("62701");
			expect(vendor.country).toBe("US");
			expect(vendor.metadata).toEqual({ tier: "gold" });
		});
	});

	// ── getVendor ──

	describe("getVendor", () => {
		it("retrieves a vendor by id", async () => {
			const created = await createTestVendor();
			const vendor = await controller.getVendor(created.id);
			expect(vendor).not.toBeNull();
			expect(vendor?.name).toBe("Acme Store");
		});

		it("returns null for non-existent vendor", async () => {
			const vendor = await controller.getVendor("non-existent");
			expect(vendor).toBeNull();
		});
	});

	// ── getVendorBySlug ──

	describe("getVendorBySlug", () => {
		it("retrieves a vendor by slug", async () => {
			await createTestVendor();
			const vendor = await controller.getVendorBySlug("acme");
			expect(vendor).not.toBeNull();
			expect(vendor?.slug).toBe("acme");
		});

		it("returns null for non-existent slug", async () => {
			const vendor = await controller.getVendorBySlug("non-existent");
			expect(vendor).toBeNull();
		});
	});

	// ── updateVendor ──

	describe("updateVendor", () => {
		it("updates vendor name and email", async () => {
			const created = await createTestVendor();
			const updated = await controller.updateVendor(created.id, {
				name: "Acme Global",
				email: "global@acme.com",
			});
			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Acme Global");
			expect(updated?.email).toBe("global@acme.com");
			expect(updated?.slug).toBe("acme");
		});

		it("updates commission rate", async () => {
			const created = await createTestVendor();
			const updated = await controller.updateVendor(created.id, {
				commissionRate: 20,
			});
			expect(updated?.commissionRate).toBe(20);
		});

		it("clears optional fields with null", async () => {
			const created = await createTestVendor({
				description: "Premium",
				phone: "+1-555-0100",
				website: "https://acme.example.com",
				logo: "/logo.png",
				banner: "/banner.jpg",
			});
			const updated = await controller.updateVendor(created.id, {
				description: null,
				phone: null,
				website: null,
				logo: null,
				banner: null,
			});
			expect(updated).not.toBeNull();
			expect(updated?.description).toBeUndefined();
			expect(updated?.phone).toBeUndefined();
			expect(updated?.website).toBeUndefined();
			expect(updated?.logo).toBeUndefined();
			expect(updated?.banner).toBeUndefined();
		});

		it("clears address fields with null", async () => {
			const created = await createTestVendor({
				addressLine1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			});
			const updated = await controller.updateVendor(created.id, {
				addressLine1: null,
				city: null,
				state: null,
				postalCode: null,
				country: null,
			});
			expect(updated?.addressLine1).toBeUndefined();
			expect(updated?.city).toBeUndefined();
			expect(updated?.state).toBeUndefined();
			expect(updated?.postalCode).toBeUndefined();
			expect(updated?.country).toBeUndefined();
		});

		it("returns null for non-existent vendor", async () => {
			const result = await controller.updateVendor("no-id", {
				name: "X",
			});
			expect(result).toBeNull();
		});
	});

	// ── deleteVendor ──

	describe("deleteVendor", () => {
		it("deletes a vendor and cascades", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.createPayout({
				vendorId: vendor.id,
				amount: 100,
				currency: "USD",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
			});

			const deleted = await controller.deleteVendor(vendor.id);
			expect(deleted).toBe(true);

			const found = await controller.getVendor(vendor.id);
			expect(found).toBeNull();

			const products = await controller.listVendorProducts({
				vendorId: vendor.id,
			});
			expect(products).toHaveLength(0);

			const payouts = await controller.listPayouts({
				vendorId: vendor.id,
			});
			expect(payouts).toHaveLength(0);
		});

		it("returns false for non-existent vendor", async () => {
			const result = await controller.deleteVendor("no-id");
			expect(result).toBe(false);
		});
	});

	// ── listVendors ──

	describe("listVendors", () => {
		it("lists all vendors", async () => {
			await createTestVendor({ slug: "v1" });
			await createTestVendor({ slug: "v2" });
			await createTestVendor({ slug: "v3" });

			const vendors = await controller.listVendors();
			expect(vendors).toHaveLength(3);
		});

		it("filters by status", async () => {
			await createTestVendor({ slug: "active-v", status: "active" });
			await createTestVendor({ slug: "pending-v", status: "pending" });

			const active = await controller.listVendors({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].slug).toBe("active-v");
		});

		it("supports pagination", async () => {
			await createTestVendor({ slug: "a" });
			await createTestVendor({ slug: "b" });
			await createTestVendor({ slug: "c" });

			const page = await controller.listVendors({ take: 2, skip: 0 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countVendors ──

	describe("countVendors", () => {
		it("counts vendors with filters", async () => {
			await createTestVendor({ slug: "a", status: "active" });
			await createTestVendor({ slug: "b", status: "pending" });
			await createTestVendor({ slug: "c", status: "active" });

			const total = await controller.countVendors();
			expect(total).toBe(3);

			const active = await controller.countVendors({ status: "active" });
			expect(active).toBe(2);
		});
	});

	// ── updateVendorStatus ──

	describe("updateVendorStatus", () => {
		it("updates vendor status to active", async () => {
			const vendor = await createTestVendor();
			expect(vendor.status).toBe("pending");

			const updated = await controller.updateVendorStatus(vendor.id, "active");
			expect(updated?.status).toBe("active");
		});

		it("suspends a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const updated = await controller.updateVendorStatus(
				vendor.id,
				"suspended",
			);
			expect(updated?.status).toBe("suspended");
		});

		it("closes a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const updated = await controller.updateVendorStatus(vendor.id, "closed");
			expect(updated?.status).toBe("closed");
		});

		it("returns null for non-existent vendor", async () => {
			const result = await controller.updateVendorStatus("no-id", "active");
			expect(result).toBeNull();
		});
	});

	// ── assignProduct ──

	describe("assignProduct", () => {
		it("assigns a product to a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const assignment = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			expect(assignment.id).toBeDefined();
			expect(assignment.vendorId).toBe(vendor.id);
			expect(assignment.productId).toBe("prod_1");
			expect(assignment.status).toBe("active");
			expect(assignment.createdAt).toBeInstanceOf(Date);
		});

		it("assigns with commission override", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const assignment = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
				commissionOverride: 25,
			});
			expect(assignment.commissionOverride).toBe(25);
		});

		it("is idempotent — returns existing if already assigned", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const first = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			const second = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			expect(first.id).toBe(second.id);
		});
	});

	// ── unassignProduct ──

	describe("unassignProduct", () => {
		it("unassigns a product from a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			const removed = await controller.unassignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			expect(removed).toBe(true);
		});

		it("returns false when product not assigned", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const result = await controller.unassignProduct({
				vendorId: vendor.id,
				productId: "no-product",
			});
			expect(result).toBe(false);
		});
	});

	// ── listVendorProducts ──

	describe("listVendorProducts", () => {
		it("lists products for a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_2",
			});

			const products = await controller.listVendorProducts({
				vendorId: vendor.id,
			});
			expect(products).toHaveLength(2);
		});

		it("supports pagination", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_2",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_3",
			});

			const page = await controller.listVendorProducts({
				vendorId: vendor.id,
				take: 2,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countVendorProducts ──

	describe("countVendorProducts", () => {
		it("counts vendor products", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_2",
			});

			const count = await controller.countVendorProducts({
				vendorId: vendor.id,
			});
			expect(count).toBe(2);
		});
	});

	// ── getProductVendor ──

	describe("getProductVendor", () => {
		it("returns vendor for assigned product", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});

			const result = await controller.getProductVendor("prod_1");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(vendor.id);
		});

		it("returns null for unassigned product", async () => {
			const result = await controller.getProductVendor("unassigned-prod");
			expect(result).toBeNull();
		});
	});

	// ── createPayout ──

	describe("createPayout", () => {
		it("creates a payout for a vendor", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			expect(payout.id).toBeDefined();
			expect(payout.vendorId).toBe(vendor.id);
			expect(payout.amount).toBe(500);
			expect(payout.currency).toBe("USD");
			expect(payout.status).toBe("pending");
			expect(payout.periodStart).toBeInstanceOf(Date);
			expect(payout.periodEnd).toBeInstanceOf(Date);
			expect(payout.createdAt).toBeInstanceOf(Date);
		});

		it("creates a payout with optional fields", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await controller.createPayout({
				vendorId: vendor.id,
				amount: 1000,
				currency: "EUR",
				method: "bank_transfer",
				reference: "PAY-2026-001",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-01-31"),
				notes: "January payout",
			});
			expect(payout.method).toBe("bank_transfer");
			expect(payout.reference).toBe("PAY-2026-001");
			expect(payout.notes).toBe("January payout");
		});

		it("throws when vendor not found", async () => {
			await expect(
				controller.createPayout({
					vendorId: "no-vendor",
					amount: 100,
					currency: "USD",
					periodStart: new Date("2026-01-01"),
					periodEnd: new Date("2026-01-31"),
				}),
			).rejects.toThrow("Vendor not found");
		});
	});

	// ── getPayout ──

	describe("getPayout", () => {
		it("retrieves a payout by id", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const created = await createTestPayout(vendor.id);
			const payout = await controller.getPayout(created.id);
			expect(payout).not.toBeNull();
			expect(payout?.amount).toBe(500);
		});

		it("returns null for non-existent payout", async () => {
			const payout = await controller.getPayout("non-existent");
			expect(payout).toBeNull();
		});
	});

	// ── updatePayoutStatus ──

	describe("updatePayoutStatus", () => {
		it("updates payout to processing", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			const updated = await controller.updatePayoutStatus(
				payout.id,
				"processing",
			);
			expect(updated?.status).toBe("processing");
			expect(updated?.completedAt).toBeUndefined();
		});

		it("sets completedAt when status is completed", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			const updated = await controller.updatePayoutStatus(
				payout.id,
				"completed",
			);
			expect(updated?.status).toBe("completed");
			expect(updated?.completedAt).toBeInstanceOf(Date);
		});

		it("updates payout to failed", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			const updated = await controller.updatePayoutStatus(payout.id, "failed");
			expect(updated?.status).toBe("failed");
		});

		it("returns null for non-existent payout", async () => {
			const result = await controller.updatePayoutStatus("no-id", "completed");
			expect(result).toBeNull();
		});
	});

	// ── listPayouts ──

	describe("listPayouts", () => {
		it("lists all payouts", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await createTestPayout(vendor.id);
			await createTestPayout(vendor.id);

			const payouts = await controller.listPayouts();
			expect(payouts).toHaveLength(2);
		});

		it("filters by vendorId", async () => {
			const v1 = await createTestVendor({
				slug: "v1",
				status: "active",
			});
			const v2 = await createTestVendor({
				slug: "v2",
				status: "active",
			});
			await createTestPayout(v1.id);
			await createTestPayout(v2.id);

			const payouts = await controller.listPayouts({
				vendorId: v1.id,
			});
			expect(payouts).toHaveLength(1);
			expect(payouts[0].vendorId).toBe(v1.id);
		});

		it("filters by status", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const p1 = await createTestPayout(vendor.id);
			await createTestPayout(vendor.id);
			await controller.updatePayoutStatus(p1.id, "completed");

			const completed = await controller.listPayouts({
				status: "completed",
			});
			expect(completed).toHaveLength(1);
		});

		it("supports pagination", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await createTestPayout(vendor.id);
			await createTestPayout(vendor.id);
			await createTestPayout(vendor.id);

			const page = await controller.listPayouts({ take: 2, skip: 0 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countPayouts ──

	describe("countPayouts", () => {
		it("counts payouts with filters", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const p1 = await createTestPayout(vendor.id);
			await createTestPayout(vendor.id);
			await controller.updatePayoutStatus(p1.id, "completed");

			const total = await controller.countPayouts();
			expect(total).toBe(2);

			const completed = await controller.countPayouts({
				status: "completed",
			});
			expect(completed).toBe(1);
		});
	});

	// ── getPayoutStats ──

	describe("getPayoutStats", () => {
		it("returns payout stats across all vendors", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const p1 = await createTestPayout(vendor.id);
			const p2 = await createTestPayout(vendor.id);
			await controller.updatePayoutStatus(p1.id, "completed");
			await controller.updatePayoutStatus(p2.id, "processing");

			const stats = await controller.getPayoutStats();
			expect(stats.totalPayouts).toBe(2);
			expect(stats.completedAmount).toBe(500);
			expect(stats.processingAmount).toBe(500);
			expect(stats.pendingAmount).toBe(0);
		});

		it("filters stats by vendorId", async () => {
			const v1 = await createTestVendor({
				slug: "v1",
				status: "active",
			});
			const v2 = await createTestVendor({
				slug: "v2",
				status: "active",
			});
			await createTestPayout(v1.id);
			await createTestPayout(v2.id);

			const stats = await controller.getPayoutStats(v1.id);
			expect(stats.totalPayouts).toBe(1);
			expect(stats.pendingAmount).toBe(500);
		});

		it("returns zeros when no payouts", async () => {
			const stats = await controller.getPayoutStats();
			expect(stats.totalPayouts).toBe(0);
			expect(stats.pendingAmount).toBe(0);
			expect(stats.completedAmount).toBe(0);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns correct marketplace stats", async () => {
			const v1 = await createTestVendor({
				slug: "v1",
				status: "active",
			});
			await createTestVendor({ slug: "v2", status: "pending" });
			await createTestVendor({ slug: "v3", status: "suspended" });

			await controller.assignProduct({
				vendorId: v1.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				vendorId: v1.id,
				productId: "prod_2",
			});

			const p1 = await createTestPayout(v1.id);
			await createTestPayout(v1.id);
			await controller.updatePayoutStatus(p1.id, "completed");

			const stats = await controller.getStats();
			expect(stats.totalVendors).toBe(3);
			expect(stats.activeVendors).toBe(1);
			expect(stats.pendingVendors).toBe(1);
			expect(stats.suspendedVendors).toBe(1);
			expect(stats.totalProducts).toBe(2);
			expect(stats.totalPayouts).toBe(2);
			expect(stats.completedPayoutAmount).toBe(500);
			expect(stats.pendingPayoutAmount).toBe(500);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalVendors).toBe(0);
			expect(stats.activeVendors).toBe(0);
			expect(stats.totalProducts).toBe(0);
			expect(stats.totalPayouts).toBe(0);
			expect(stats.pendingPayoutAmount).toBe(0);
			expect(stats.completedPayoutAmount).toBe(0);
		});
	});

	// ── vendor application flow ──

	describe("vendor application flow", () => {
		it("vendor applies as pending, then gets approved", async () => {
			const vendor = await createTestVendor({ status: "pending" });
			expect(vendor.status).toBe("pending");

			const approved = await controller.updateVendorStatus(vendor.id, "active");
			expect(approved?.status).toBe("active");

			// Can now have products assigned
			const assignment = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod_1",
			});
			expect(assignment.vendorId).toBe(vendor.id);

			// Product vendor lookup works
			const found = await controller.getProductVendor("prod_1");
			expect(found?.id).toBe(vendor.id);
		});
	});

	// ── payout lifecycle ──

	describe("payout lifecycle", () => {
		it("goes through pending → processing → completed", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
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
			expect(completed?.completedAt).toBeInstanceOf(Date);
		});

		it("can transition to failed", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			await controller.updatePayoutStatus(payout.id, "processing");
			const failed = await controller.updatePayoutStatus(payout.id, "failed");
			expect(failed?.status).toBe("failed");
		});
	});
});
