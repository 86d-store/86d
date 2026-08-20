import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createVendorController } from "../service-impl";

describe("vendor controllers — edge cases", () => {
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

	async function createTestPayout(
		vendorId: string,
		overrides: Partial<
			Omit<Parameters<typeof controller.createPayout>[0], "vendorId">
		> = {},
	) {
		return controller.createPayout({
			vendorId,
			amount: 500,
			currency: "USD",
			periodStart: new Date("2026-01-01"),
			periodEnd: new Date("2026-01-31"),
			...overrides,
		});
	}

	// ── Default values ──────────────────────────────────────────────

	describe("default values", () => {
		it("defaults commissionRate to 10 and status to pending", async () => {
			const vendor = await createTestVendor();
			expect(vendor.commissionRate).toBe(10);
			expect(vendor.status).toBe("pending");
		});

		it("allows overriding commissionRate and status", async () => {
			const vendor = await createTestVendor({
				commissionRate: 25,
				status: "active",
			});
			expect(vendor.commissionRate).toBe(25);
			expect(vendor.status).toBe("active");
		});

		it("omits optional fields when not provided", async () => {
			const vendor = await createTestVendor();
			expect(vendor.phone).toBeUndefined();
			expect(vendor.description).toBeUndefined();
			expect(vendor.logo).toBeUndefined();
			expect(vendor.banner).toBeUndefined();
			expect(vendor.website).toBeUndefined();
			expect(vendor.addressLine1).toBeUndefined();
			expect(vendor.metadata).toBeUndefined();
		});

		it("preserves empty string optional fields", async () => {
			const vendor = await createTestVendor({
				description: "",
				phone: "",
				website: "",
			});
			expect(vendor.description).toBe("");
			expect(vendor.phone).toBe("");
			expect(vendor.website).toBe("");
		});
	});

	// ── deleteVendor cascade ────────────────────────────────────────

	describe("deleteVendor — cascade behavior", () => {
		it("cascade deletes all product assignments and payouts", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-2",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-3",
			});
			await createTestPayout(vendor.id, { amount: 100 });
			await createTestPayout(vendor.id, { amount: 200 });

			const deleted = await controller.deleteVendor(vendor.id);
			expect(deleted).toBe(true);

			expect(await controller.getVendor(vendor.id)).toBeNull();
			expect(
				await controller.listVendorProducts({ vendorId: vendor.id }),
			).toHaveLength(0);
			expect(
				await controller.listPayouts({ vendorId: vendor.id }),
			).toHaveLength(0);
		});

		it("deleting a vendor does not affect other vendors' data", async () => {
			const vendorA = await createTestVendor({
				slug: "vendor-a",
				status: "active",
			});
			const vendorB = await createTestVendor({
				slug: "vendor-b",
				status: "active",
			});

			await controller.assignProduct({
				vendorId: vendorA.id,
				productId: "prod-a",
			});
			await controller.assignProduct({
				vendorId: vendorB.id,
				productId: "prod-b",
			});
			await createTestPayout(vendorA.id);
			await createTestPayout(vendorB.id);

			await controller.deleteVendor(vendorA.id);

			expect(
				await controller.listVendorProducts({ vendorId: vendorB.id }),
			).toHaveLength(1);
			expect(
				await controller.listPayouts({ vendorId: vendorB.id }),
			).toHaveLength(1);
		});

		it("returns false for non-existent vendor", async () => {
			expect(await controller.deleteVendor("ghost-vendor")).toBe(false);
		});
	});

	// ── assignProduct idempotency ───────────────────────────────────

	describe("assignProduct — idempotency", () => {
		it("returns existing assignment on repeated calls without creating duplicates", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const first = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			const second = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			const third = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});

			expect(first.id).toBe(second.id);
			expect(second.id).toBe(third.id);
			expect(
				await controller.countVendorProducts({ vendorId: vendor.id }),
			).toBe(1);
		});

		it("different products create separate assignments", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const a = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			const b = await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-2",
			});

			expect(a.id).not.toBe(b.id);
			expect(
				await controller.countVendorProducts({ vendorId: vendor.id }),
			).toBe(2);
		});
	});

	// ── createPayout throws for non-existent vendor ─────────────────

	describe("createPayout — vendor validation", () => {
		it("throws when vendor does not exist", async () => {
			await expect(
				controller.createPayout({
					vendorId: "non-existent-vendor",
					amount: 100,
					currency: "USD",
					periodStart: new Date("2026-01-01"),
					periodEnd: new Date("2026-01-31"),
				}),
			).rejects.toThrow("Vendor not found");
		});

		it("throws after vendor is deleted", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.deleteVendor(vendor.id);

			await expect(createTestPayout(vendor.id)).rejects.toThrow(
				"Vendor not found",
			);
		});

		it("creates payout with default pending status and no completedAt", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);
			expect(payout.status).toBe("pending");
			expect(payout.completedAt).toBeUndefined();
		});
	});

	// ── updatePayoutStatus — completedAt behavior ───────────────────

	describe("updatePayoutStatus — completedAt", () => {
		it("sets completedAt only when status is completed", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);

			const processing = await controller.updatePayoutStatus(
				payout.id,
				"processing",
			);
			expect(processing?.status).toBe("processing");
			expect(processing?.completedAt).toBeUndefined();

			const completed = await controller.updatePayoutStatus(
				payout.id,
				"completed",
			);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeInstanceOf(Date);
		});

		it("does not set completedAt for failed status", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await createTestPayout(vendor.id);

			const failed = await controller.updatePayoutStatus(payout.id, "failed");
			expect(failed?.status).toBe("failed");
			expect(failed?.completedAt).toBeUndefined();
		});

		it("returns null for non-existent payout", async () => {
			const result = await controller.updatePayoutStatus(
				"ghost-payout",
				"completed",
			);
			expect(result).toBeNull();
		});

		it("preserves optional payout fields through status updates", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const payout = await controller.createPayout({
				vendorId: vendor.id,
				amount: 750,
				currency: "EUR",
				method: "bank_transfer",
				reference: "REF-001",
				notes: "Monthly payout",
				periodStart: new Date("2026-02-01"),
				periodEnd: new Date("2026-02-28"),
			});

			const completed = await controller.updatePayoutStatus(
				payout.id,
				"completed",
			);

			expect(completed?.method).toBe("bank_transfer");
			expect(completed?.reference).toBe("REF-001");
			expect(completed?.notes).toBe("Monthly payout");
			expect(completed?.amount).toBe(750);
			expect(completed?.currency).toBe("EUR");
		});
	});

	// ── getProductVendor — active assignments only ───────────────────

	describe("getProductVendor — active assignments only", () => {
		it("returns vendor for active assignment", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});

			const result = await controller.getProductVendor("prod-1");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(vendor.id);
		});

		it("returns null after product is unassigned", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			await controller.unassignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});

			expect(await controller.getProductVendor("prod-1")).toBeNull();
		});

		it("returns null for never-assigned and cascade-deleted products", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});
			await controller.deleteVendor(vendor.id);

			expect(await controller.getProductVendor("prod-1")).toBeNull();
			expect(await controller.getProductVendor("never-assigned")).toBeNull();
		});
	});

	// ── getPayoutStats — aggregation with multiple statuses ─────────

	describe("getPayoutStats — aggregation", () => {
		it("aggregates amounts by status correctly", async () => {
			const vendor = await createTestVendor({ status: "active" });
			const p1 = await createTestPayout(vendor.id, { amount: 100 });
			const p2 = await createTestPayout(vendor.id, { amount: 200 });
			const p3 = await createTestPayout(vendor.id, { amount: 300 });
			await createTestPayout(vendor.id, { amount: 400 });
			await createTestPayout(vendor.id, { amount: 50 });

			await controller.updatePayoutStatus(p1.id, "completed");
			await controller.updatePayoutStatus(p2.id, "processing");
			await controller.updatePayoutStatus(p3.id, "failed");

			const stats = await controller.getPayoutStats();
			expect(stats.totalPayouts).toBe(5);
			expect(stats.completedAmount).toBe(100);
			expect(stats.processingAmount).toBe(200);
			expect(stats.failedAmount).toBe(300);
			expect(stats.pendingAmount).toBe(450);
		});

		it("filters stats by vendorId", async () => {
			const v1 = await createTestVendor({ slug: "v1", status: "active" });
			const v2 = await createTestVendor({ slug: "v2", status: "active" });

			await createTestPayout(v1.id, { amount: 100 });
			await createTestPayout(v1.id, { amount: 200 });
			await createTestPayout(v2.id, { amount: 999 });

			const v1Stats = await controller.getPayoutStats(v1.id);
			expect(v1Stats.totalPayouts).toBe(2);
			expect(v1Stats.pendingAmount).toBe(300);

			const v2Stats = await controller.getPayoutStats(v2.id);
			expect(v2Stats.totalPayouts).toBe(1);
			expect(v2Stats.pendingAmount).toBe(999);
		});

		it("returns zeros when no payouts exist", async () => {
			const stats = await controller.getPayoutStats();
			expect(stats.totalPayouts).toBe(0);
			expect(stats.pendingAmount).toBe(0);
			expect(stats.processingAmount).toBe(0);
			expect(stats.completedAmount).toBe(0);
			expect(stats.failedAmount).toBe(0);
		});
	});

	// ── getStats — vendor status counts ─────────────────────────────

	describe("getStats — vendor status counts", () => {
		it("counts all vendor statuses correctly", async () => {
			await createTestVendor({ slug: "a1", status: "active" });
			await createTestVendor({ slug: "a2", status: "active" });
			await createTestVendor({ slug: "p1", status: "pending" });
			await createTestVendor({ slug: "s1", status: "suspended" });
			await createTestVendor({ slug: "s2", status: "suspended" });
			await createTestVendor({ slug: "s3", status: "suspended" });

			const stats = await controller.getStats();
			expect(stats.totalVendors).toBe(6);
			expect(stats.activeVendors).toBe(2);
			expect(stats.pendingVendors).toBe(1);
			expect(stats.suspendedVendors).toBe(3);
		});

		it("counts products and payouts with correct amounts", async () => {
			const v1 = await createTestVendor({ slug: "v1", status: "active" });
			const v2 = await createTestVendor({ slug: "v2", status: "active" });

			await controller.assignProduct({ vendorId: v1.id, productId: "p1" });
			await controller.assignProduct({ vendorId: v1.id, productId: "p2" });
			await controller.assignProduct({ vendorId: v2.id, productId: "p3" });

			const payout1 = await createTestPayout(v1.id, { amount: 100 });
			await createTestPayout(v2.id, { amount: 300 });
			await controller.updatePayoutStatus(payout1.id, "completed");

			const stats = await controller.getStats();
			expect(stats.totalProducts).toBe(3);
			expect(stats.totalPayouts).toBe(2);
			expect(stats.completedPayoutAmount).toBe(100);
			expect(stats.pendingPayoutAmount).toBe(300);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalVendors).toBe(0);
			expect(stats.activeVendors).toBe(0);
			expect(stats.pendingVendors).toBe(0);
			expect(stats.suspendedVendors).toBe(0);
			expect(stats.totalProducts).toBe(0);
			expect(stats.totalPayouts).toBe(0);
			expect(stats.pendingPayoutAmount).toBe(0);
			expect(stats.completedPayoutAmount).toBe(0);
		});
	});

	// ── updateVendor — clearing optional fields ─────────────────────

	describe("updateVendor — clearing fields with null", () => {
		it("clears optional string fields by setting null", async () => {
			const vendor = await createTestVendor({
				phone: "+1-555-0100",
				description: "Premium vendor",
				logo: "/logo.png",
				banner: "/banner.jpg",
				website: "https://acme.example.com",
			});

			const updated = await controller.updateVendor(vendor.id, {
				phone: null,
				description: null,
				logo: null,
				banner: null,
				website: null,
			});

			expect(updated).not.toBeNull();
			expect(updated?.phone).toBeUndefined();
			expect(updated?.description).toBeUndefined();
			expect(updated?.logo).toBeUndefined();
			expect(updated?.banner).toBeUndefined();
			expect(updated?.website).toBeUndefined();
			expect(updated?.name).toBe("Acme Store");
			expect(updated?.email).toBe("vendor@acme.com");
		});

		it("clears address and metadata fields by setting null", async () => {
			const vendor = await createTestVendor({
				addressLine1: "123 Main St",
				addressLine2: "Suite 200",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
				metadata: { tier: "gold" },
			});

			const updated = await controller.updateVendor(vendor.id, {
				addressLine1: null,
				addressLine2: null,
				city: null,
				state: null,
				postalCode: null,
				country: null,
				metadata: null,
			});

			expect(updated?.addressLine1).toBeUndefined();
			expect(updated?.addressLine2).toBeUndefined();
			expect(updated?.city).toBeUndefined();
			expect(updated?.state).toBeUndefined();
			expect(updated?.postalCode).toBeUndefined();
			expect(updated?.country).toBeUndefined();
			expect(updated?.metadata).toBeUndefined();
		});

		it("partial update preserves unmentioned optional fields", async () => {
			const vendor = await createTestVendor({
				phone: "+1-555-0100",
				description: "Premium vendor",
				website: "https://acme.example.com",
			});

			const updated = await controller.updateVendor(vendor.id, {
				name: "Acme Updated",
			});

			expect(updated?.name).toBe("Acme Updated");
			expect(updated?.phone).toBe("+1-555-0100");
			expect(updated?.description).toBe("Premium vendor");
			expect(updated?.website).toBe("https://acme.example.com");
		});
	});

	// ── Count methods with status filters ────────────────────────────

	describe("count methods — status filters", () => {
		it("countVendors filters by each status", async () => {
			await createTestVendor({ slug: "a", status: "active" });
			await createTestVendor({ slug: "b", status: "active" });
			await createTestVendor({ slug: "c", status: "pending" });
			await createTestVendor({ slug: "d", status: "suspended" });
			await createTestVendor({ slug: "e", status: "closed" });

			expect(await controller.countVendors()).toBe(5);
			expect(await controller.countVendors({ status: "active" })).toBe(2);
			expect(await controller.countVendors({ status: "pending" })).toBe(1);
			expect(await controller.countVendors({ status: "suspended" })).toBe(1);
			expect(await controller.countVendors({ status: "closed" })).toBe(1);
		});

		it("countVendorProducts filters by status", async () => {
			const vendor = await createTestVendor({ status: "active" });
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "p1",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "p2",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "p3",
			});

			expect(
				await controller.countVendorProducts({ vendorId: vendor.id }),
			).toBe(3);
			expect(
				await controller.countVendorProducts({
					vendorId: vendor.id,
					status: "active",
				}),
			).toBe(3);
			expect(
				await controller.countVendorProducts({
					vendorId: vendor.id,
					status: "paused",
				}),
			).toBe(0);
		});

		it("countPayouts filters by status and vendorId", async () => {
			const v1 = await createTestVendor({ slug: "v1", status: "active" });
			const v2 = await createTestVendor({ slug: "v2", status: "active" });
			const p1 = await createTestPayout(v1.id);
			const p2 = await createTestPayout(v1.id);
			await createTestPayout(v2.id);

			await controller.updatePayoutStatus(p1.id, "completed");
			await controller.updatePayoutStatus(p2.id, "processing");

			expect(await controller.countPayouts()).toBe(3);
			expect(await controller.countPayouts({ status: "pending" })).toBe(1);
			expect(await controller.countPayouts({ status: "completed" })).toBe(1);
			expect(await controller.countPayouts({ status: "processing" })).toBe(1);
			expect(await controller.countPayouts({ status: "failed" })).toBe(0);
			expect(await controller.countPayouts({ vendorId: v1.id })).toBe(2);
			expect(await controller.countPayouts({ vendorId: v2.id })).toBe(1);
		});
	});

	// ── Cross-method interactions ────────────────────────────────────

	describe("cross-method interactions", () => {
		it("updating vendor slug does not break product lookups", async () => {
			const vendor = await createTestVendor({
				slug: "old-slug",
				status: "active",
			});
			await controller.assignProduct({
				vendorId: vendor.id,
				productId: "prod-1",
			});

			await controller.updateVendor(vendor.id, { slug: "new-slug" });

			const found = await controller.getProductVendor("prod-1");
			expect(found?.slug).toBe("new-slug");
			expect(
				await controller.countVendorProducts({ vendorId: vendor.id }),
			).toBe(1);
		});

		it("getVendorBySlug returns null after slug is changed", async () => {
			const vendor = await createTestVendor({ slug: "original" });
			await controller.updateVendor(vendor.id, { slug: "changed" });

			expect(await controller.getVendorBySlug("original")).toBeNull();
			expect((await controller.getVendorBySlug("changed"))?.id).toBe(vendor.id);
		});

		it("updateVendorStatus reflects in countVendors", async () => {
			const vendor = await createTestVendor({ status: "pending" });

			expect(await controller.countVendors({ status: "pending" })).toBe(1);
			expect(await controller.countVendors({ status: "active" })).toBe(0);

			await controller.updateVendorStatus(vendor.id, "active");

			expect(await controller.countVendors({ status: "pending" })).toBe(0);
			expect(await controller.countVendors({ status: "active" })).toBe(1);
		});

		it("stats update after delete-recreate cycle and vendor status transitions", async () => {
			const v1 = await createTestVendor({
				slug: "v1",
				status: "active",
			});
			await controller.assignProduct({
				vendorId: v1.id,
				productId: "p1",
			});
			await createTestPayout(v1.id, { amount: 250 });

			let stats = await controller.getStats();
			expect(stats.totalVendors).toBe(1);
			expect(stats.totalProducts).toBe(1);
			expect(stats.totalPayouts).toBe(1);
			expect(stats.pendingPayoutAmount).toBe(250);

			await controller.deleteVendor(v1.id);

			stats = await controller.getStats();
			expect(stats.totalVendors).toBe(0);
			expect(stats.totalProducts).toBe(0);
			expect(stats.totalPayouts).toBe(0);
			expect(stats.pendingPayoutAmount).toBe(0);

			// Recreate and verify status transitions
			const v2 = await createTestVendor({
				slug: "v2",
				status: "pending",
			});
			expect(v2.status).toBe("pending");

			const active = await controller.updateVendorStatus(v2.id, "active");
			expect(active?.status).toBe("active");

			const suspended = await controller.updateVendorStatus(v2.id, "suspended");
			expect(suspended?.status).toBe("suspended");

			const closed = await controller.updateVendorStatus(v2.id, "closed");
			expect(closed?.status).toBe("closed");

			stats = await controller.getStats();
			expect(stats.totalVendors).toBe(1);
		});
	});
});
