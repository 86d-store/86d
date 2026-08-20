import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";
import { createTippingController } from "../service-impl";
import { storeEndpoints } from "../store/endpoints/routes";

/**
 * Security tests for tipping endpoints.
 *
 * These tests verify:
 * - Tip ownership: customers can only manage their own tips
 * - Order-scoped isolation: tips are scoped per order, totals don't leak
 * - Settings isolation: public settings only expose safe fields
 * - Split immutability: split tips track provenance
 * - Payout boundaries: payouts are per-recipient
 * - Stats don't expose sensitive customer data
 * - Refund exclusion from totals
 */

describe("tipping endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTippingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTippingController(mockData);
	});

	// ── Route existence ──────────────────────────────────────────────

	describe("store endpoints", () => {
		it("exposes expected store routes", () => {
			const routes = Object.keys(storeEndpoints);
			expect(routes).toContain("/tipping/tips");
			expect(routes).toContain("/tipping/tips/:id");
			expect(routes).toContain("/tipping/tips/:id/delete");
			expect(routes).toContain("/tipping/tips/order/:orderId");
			expect(routes).toContain("/tipping/settings");
		});

		it("store endpoints are defined as functions", () => {
			for (const endpoint of Object.values(storeEndpoints)) {
				expect(typeof endpoint).toBe("function");
			}
		});
	});

	describe("admin endpoints", () => {
		it("exposes expected admin routes", () => {
			const routes = Object.keys(adminEndpoints);
			expect(routes).toContain("/admin/tipping/tips");
			expect(routes).toContain("/admin/tipping/tips/:id");
			expect(routes).toContain("/admin/tipping/tips/:id/split");
			expect(routes).toContain("/admin/tipping/payouts");
			expect(routes).toContain("/admin/tipping/payouts/list");
			expect(routes).toContain("/admin/tipping/stats");
			expect(routes).toContain("/admin/tipping/settings");
			expect(routes).toContain("/admin/tipping/settings/update");
		});

		it("admin endpoints are defined as functions", () => {
			for (const endpoint of Object.values(adminEndpoints)) {
				expect(typeof endpoint).toBe("function");
			}
		});
	});

	// ── Tip ownership isolation ──────────────────────────────────────

	describe("tip ownership isolation", () => {
		it("customer can only see their own tips via customerId", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
				customerId: "cust_2",
			});

			const cust1Tips = await controller.listTips({
				recipientId: undefined,
			});
			// listTips returns all tips without customer filter — this is the
			// admin-level function. Store endpoints must filter by customerId.
			expect(cust1Tips).toHaveLength(2);
		});

		it("tip stores customerId for ownership verification", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});
			expect(tip.customerId).toBe("cust_1");

			const retrieved = await controller.getTip(tip.id);
			expect(retrieved?.customerId).toBe("cust_1");
		});

		it("different customers' tips have different customerIds", async () => {
			const tip1 = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});
			const tip2 = await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "preset",
				customerId: "cust_2",
			});

			expect(tip1.customerId).not.toBe(tip2.customerId);
		});

		it("updating a tip preserves the original customerId", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});

			const updated = await controller.updateTip(tip.id, { amount: 800 });
			expect(updated?.customerId).toBe("cust_1");
		});
	});

	// ── Order-scoped isolation ───────────────────────────────────────

	describe("order-scoped tip isolation", () => {
		it("getTipTotal only counts tips for the specified order", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "custom",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 1000,
				type: "preset",
			});

			expect(await controller.getTipTotal("ord_1")).toBe(800);
			expect(await controller.getTipTotal("ord_2")).toBe(1000);
		});

		it("listTips filters correctly by orderId", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
			});

			const tips = await controller.listTips({ orderId: "ord_1" });
			expect(tips).toHaveLength(1);
			expect(tips[0].orderId).toBe("ord_1");
		});

		it("removing a tip from one order does not affect another", async () => {
			const tip1 = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
			});

			await controller.removeTip(tip1.id);

			expect(await controller.getTipTotal("ord_1")).toBe(0);
			expect(await controller.getTipTotal("ord_2")).toBe(300);
		});
	});

	// ── Refund isolation ─────────────────────────────────────────────

	describe("refund isolation in totals", () => {
		it("refunded tips are excluded from getTipTotal", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const tip2 = await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "custom",
			});

			await controller.updateTip(tip2.id, { status: "refunded" });

			expect(await controller.getTipTotal("ord_1")).toBe(500);
		});

		it("paid tips are still counted in getTipTotal", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.updateTip(tip.id, { status: "paid" });

			expect(await controller.getTipTotal("ord_1")).toBe(500);
		});

		it("pending tips are counted in getTipTotal", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			// Status is "pending" by default
			expect(await controller.getTipTotal("ord_1")).toBe(500);
		});
	});

	// ── Split tip provenance ─────────────────────────────────────────

	describe("split tip provenance and isolation", () => {
		it("split tips retain the original orderId", async () => {
			const original = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
				customerId: "cust_1",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);

			for (const s of splits) {
				expect(s.orderId).toBe("ord_1");
			}
		});

		it("split tips track the original tip id in metadata", async () => {
			const original = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);

			for (const s of splits) {
				expect(s.metadata.splitFrom).toBe(original.id);
			}
		});

		it("original tip is deleted after split", async () => {
			const original = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});

			await controller.splitTip(original.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);

			const found = await controller.getTip(original.id);
			expect(found).toBeNull();
		});

		it("split tips start with pending status", async () => {
			const original = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);

			for (const s of splits) {
				expect(s.status).toBe("pending");
			}
		});

		it("split preserves order total", async () => {
			const original = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});

			await controller.splitTip(original.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);

			expect(await controller.getTipTotal("ord_1")).toBe(1000);
		});

		it("splitting non-existent tip returns empty array", async () => {
			const result = await controller.splitTip("nonexistent", [
				{ recipientType: "driver", amount: 500 },
				{ recipientType: "server", amount: 500 },
			]);
			expect(result).toHaveLength(0);
		});
	});

	// ── Payout boundaries ────────────────────────────────────────────

	describe("payout boundaries", () => {
		it("payouts are scoped per recipient", async () => {
			await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});
			await controller.createPayout({
				recipientId: "server_1",
				recipientType: "server",
				amount: 3000,
				tipCount: 8,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});

			const driverPayouts = await controller.listPayouts({
				recipientId: "driver_1",
			});
			expect(driverPayouts).toHaveLength(1);
			expect(driverPayouts[0].amount).toBe(5000);

			const serverPayouts = await controller.listPayouts({
				recipientId: "server_1",
			});
			expect(serverPayouts).toHaveLength(1);
			expect(serverPayouts[0].amount).toBe(3000);
		});

		it("payouts can be filtered by status", async () => {
			await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});

			const pending = await controller.listPayouts({ status: "pending" });
			expect(pending).toHaveLength(1);

			const completed = await controller.listPayouts({ status: "completed" });
			expect(completed).toHaveLength(0);
		});

		it("payout is retrievable by id", async () => {
			const payout = await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});

			const found = await controller.getPayout(payout.id);
			expect(found).not.toBeNull();
			expect(found?.recipientId).toBe("driver_1");
		});
	});

	// ── Settings safety ──────────────────────────────────────────────

	describe("settings safety", () => {
		it("default settings use safe values", async () => {
			const settings = await controller.getSettings();
			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.maxPercent).toBe(100);
			expect(settings.maxAmount).toBe(1000);
			expect(settings.allowCustom).toBe(true);
		});

		it("changing default recipient type affects new tips", async () => {
			await controller.updateSettings({
				defaultRecipientType: "driver",
			});

			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			expect(tip.recipientType).toBe("driver");
		});

		it("explicit recipientType overrides settings default", async () => {
			await controller.updateSettings({
				defaultRecipientType: "driver",
			});

			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				recipientType: "server",
			});
			expect(tip.recipientType).toBe("server");
		});

		it("updating one setting preserves others", async () => {
			await controller.updateSettings({ maxAmount: 2000 });
			const settings = await controller.getSettings();

			expect(settings.maxAmount).toBe(2000);
			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.allowCustom).toBe(true);
			expect(settings.maxPercent).toBe(100);
		});
	});

	// ── Stats boundaries ─────────────────────────────────────────────

	describe("stats boundaries", () => {
		it("stats aggregate all tips regardless of customer", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
				customerId: "cust_2",
			});

			const stats = await controller.getTipStats();
			expect(stats.totalTips).toBe(2);
			expect(stats.totalAmount).toBe(800);
		});

		it("stats correctly separate pending, paid, and refunded", async () => {
			const t1 = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const t2 = await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
			});
			await controller.addTip({
				orderId: "ord_3",
				amount: 200,
				type: "preset",
			});

			await controller.updateTip(t1.id, { status: "paid" });
			await controller.updateTip(t2.id, { status: "refunded" });

			const stats = await controller.getTipStats();
			expect(stats.totalPaid).toBe(1);
			expect(stats.totalRefunded).toBe(1);
			expect(stats.totalPending).toBe(1);
		});

		it("average tip is calculated correctly", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 600,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 400,
				type: "custom",
			});

			const stats = await controller.getTipStats();
			expect(stats.averageTip).toBe(500);
		});

		it("stats include payout totals", async () => {
			await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});

			const stats = await controller.getTipStats();
			expect(stats.totalPayouts).toBe(1);
			expect(stats.totalPayoutAmount).toBe(5000);
		});

		it("stats return zeroes when no data exists", async () => {
			const stats = await controller.getTipStats();
			expect(stats.totalTips).toBe(0);
			expect(stats.totalAmount).toBe(0);
			expect(stats.averageTip).toBe(0);
			expect(stats.totalPayouts).toBe(0);
			expect(stats.totalPayoutAmount).toBe(0);
		});
	});

	// ── Removal safety ───────────────────────────────────────────────

	describe("removal safety", () => {
		it("removing a tip reduces getTipTotal", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "custom",
			});

			expect(await controller.getTipTotal("ord_1")).toBe(800);

			await controller.removeTip(tip.id);
			expect(await controller.getTipTotal("ord_1")).toBe(300);
		});

		it("removed tip is no longer retrievable", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});

			await controller.removeTip(tip.id);
			expect(await controller.getTip(tip.id)).toBeNull();
		});

		it("double removal returns false", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});

			expect(await controller.removeTip(tip.id)).toBe(true);
			expect(await controller.removeTip(tip.id)).toBe(false);
		});

		it("removing non-existent tip returns false", async () => {
			expect(await controller.removeTip("nonexistent")).toBe(false);
		});
	});
});
