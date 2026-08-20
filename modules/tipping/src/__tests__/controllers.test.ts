import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTippingController } from "../service-impl";

describe("tipping controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTippingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTippingController(mockData);
	});

	// ── addTip ──────────────────────────────────────────────────────────

	describe("addTip", () => {
		it("adds a preset tip", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				percentage: 20,
				type: "preset",
			});
			expect(tip.id).toBeTruthy();
			expect(tip.orderId).toBe("ord_1");
			expect(tip.amount).toBe(500);
			expect(tip.percentage).toBe(20);
			expect(tip.type).toBe("preset");
			expect(tip.status).toBe("pending");
		});

		it("adds a custom tip", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});
			expect(tip.type).toBe("custom");
			expect(tip.percentage).toBeUndefined();
		});

		it("uses default recipient type from settings", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			expect(tip.recipientType).toBe("store");
		});

		it("overrides recipient type", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				recipientType: "driver",
			});
			expect(tip.recipientType).toBe("driver");
		});

		it("stores customerId", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				customerId: "cust_1",
			});
			expect(tip.customerId).toBe("cust_1");
		});

		it("stores recipientId", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
				recipientId: "driver_1",
				recipientType: "driver",
			});
			expect(tip.recipientId).toBe("driver_1");
		});

		it("sets createdAt and updatedAt", async () => {
			const before = Date.now();
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const after = Date.now();
			expect(tip.createdAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(tip.createdAt.getTime()).toBeLessThanOrEqual(after);
		});

		it("generates unique IDs", async () => {
			const t1 = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const t2 = await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "custom",
			});
			expect(t1.id).not.toBe(t2.id);
		});
	});

	// ── updateTip ───────────────────────────────────────────────────────

	describe("updateTip", () => {
		it("updates tip amount", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const updated = await controller.updateTip(tip.id, {
				amount: 800,
			});
			expect(updated?.amount).toBe(800);
		});

		it("updates tip status to paid and sets paidAt", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const updated = await controller.updateTip(tip.id, {
				status: "paid",
			});
			expect(updated?.status).toBe("paid");
			expect(updated?.paidAt).toBeDefined();
		});

		it("returns null for non-existent tip", async () => {
			const result = await controller.updateTip("nonexistent", {
				amount: 800,
			});
			expect(result).toBeNull();
		});

		it("updates multiple fields at once", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const updated = await controller.updateTip(tip.id, {
				amount: 1000,
				recipientType: "server",
				recipientId: "server_42",
			});
			expect(updated?.amount).toBe(1000);
			expect(updated?.recipientType).toBe("server");
			expect(updated?.recipientId).toBe("server_42");
		});

		it("updates updatedAt timestamp", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const original = tip.updatedAt.getTime();
			const updated = await controller.updateTip(tip.id, {
				amount: 800,
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(original);
		});
	});

	// ── removeTip ───────────────────────────────────────────────────────

	describe("removeTip", () => {
		it("removes an existing tip", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const result = await controller.removeTip(tip.id);
			expect(result).toBe(true);
			const found = await controller.getTip(tip.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent tip", async () => {
			const result = await controller.removeTip("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── getTip ──────────────────────────────────────────────────────────

	describe("getTip", () => {
		it("returns a tip by id", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const found = await controller.getTip(tip.id);
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("ord_1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getTip("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── listTips ────────────────────────────────────────────────────────

	describe("listTips", () => {
		it("returns empty array when no tips exist", async () => {
			const tips = await controller.listTips();
			expect(tips).toHaveLength(0);
		});

		it("returns all tips", async () => {
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
			const tips = await controller.listTips();
			expect(tips).toHaveLength(2);
		});

		it("filters by orderId", async () => {
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

		it("filters by status", async () => {
			const t = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
			});
			await controller.updateTip(t.id, { status: "paid" });
			const paid = await controller.listTips({ status: "paid" });
			expect(paid).toHaveLength(1);
		});

		it("respects take and skip", async () => {
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
			const page = await controller.listTips({ take: 1 });
			expect(page).toHaveLength(1);
			const skipped = await controller.listTips({ skip: 10 });
			expect(skipped).toHaveLength(0);
		});
	});

	// ── splitTip ────────────────────────────────────────────────────────

	describe("splitTip", () => {
		it("splits a tip into multiple tips", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});
			const splits = await controller.splitTip(tip.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);
			expect(splits).toHaveLength(2);
			expect(splits[0].amount).toBe(600);
			expect(splits[0].recipientType).toBe("driver");
			expect(splits[1].amount).toBe(400);
			expect(splits[1].recipientType).toBe("server");
		});

		it("removes the original tip", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});
			await controller.splitTip(tip.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);
			const found = await controller.getTip(tip.id);
			expect(found).toBeNull();
		});

		it("preserves orderId and customerId on split tips", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
				customerId: "cust_1",
			});
			const splits = await controller.splitTip(tip.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);
			for (const s of splits) {
				expect(s.orderId).toBe("ord_1");
				expect(s.customerId).toBe("cust_1");
			}
		});

		it("stores splitFrom in metadata", async () => {
			const tip = await controller.addTip({
				orderId: "ord_1",
				amount: 1000,
				type: "custom",
			});
			const splits = await controller.splitTip(tip.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);
			for (const s of splits) {
				expect(s.metadata.splitFrom).toBe(tip.id);
			}
		});

		it("returns empty array for non-existent tip", async () => {
			const splits = await controller.splitTip("nonexistent", [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "server", amount: 400 },
			]);
			expect(splits).toHaveLength(0);
		});
	});

	// ── getTipTotal ─────────────────────────────────────────────────────

	describe("getTipTotal", () => {
		it("returns 0 when no tips for order", async () => {
			const total = await controller.getTipTotal("ord_1");
			expect(total).toBe(0);
		});

		it("sums all non-refunded tips for an order", async () => {
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
			const total = await controller.getTipTotal("ord_1");
			expect(total).toBe(800);
		});

		it("excludes refunded tips", async () => {
			await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			const t2 = await controller.addTip({
				orderId: "ord_1",
				amount: 300,
				type: "custom",
			});
			await controller.updateTip(t2.id, { status: "refunded" });
			const total = await controller.getTipTotal("ord_1");
			expect(total).toBe(500);
		});

		it("does not include tips from other orders", async () => {
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
			const total = await controller.getTipTotal("ord_1");
			expect(total).toBe(500);
		});
	});

	// ── payouts ─────────────────────────────────────────────────────────

	describe("createPayout", () => {
		it("creates a payout with pending status", async () => {
			const payout = await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
			});
			expect(payout.id).toBeTruthy();
			expect(payout.status).toBe("pending");
			expect(payout.amount).toBe(5000);
			expect(payout.tipCount).toBe(10);
		});

		it("stores reference", async () => {
			const payout = await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-15"),
				reference: "PAY-001",
			});
			expect(payout.reference).toBe("PAY-001");
		});
	});

	describe("getPayout", () => {
		it("returns a payout by id", async () => {
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

		it("returns null for non-existent id", async () => {
			const found = await controller.getPayout("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listPayouts", () => {
		it("returns empty array when none exist", async () => {
			const payouts = await controller.listPayouts();
			expect(payouts).toHaveLength(0);
		});

		it("returns all payouts", async () => {
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
			const payouts = await controller.listPayouts();
			expect(payouts).toHaveLength(2);
		});
	});

	// ── settings ────────────────────────────────────────────────────────

	describe("getSettings", () => {
		it("returns default settings", async () => {
			const settings = await controller.getSettings();
			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.allowCustom).toBe(true);
			expect(settings.maxPercent).toBe(100);
			expect(settings.maxAmount).toBe(1000);
			expect(settings.enableSplitting).toBe(false);
			expect(settings.defaultRecipientType).toBe("store");
		});
	});

	describe("updateSettings", () => {
		it("updates preset percents", async () => {
			const settings = await controller.updateSettings({
				presetPercents: [10, 15, 20],
			});
			expect(settings.presetPercents).toEqual([10, 15, 20]);
		});

		it("updates multiple settings", async () => {
			const settings = await controller.updateSettings({
				allowCustom: false,
				maxPercent: 50,
				enableSplitting: true,
				defaultRecipientType: "driver",
			});
			expect(settings.allowCustom).toBe(false);
			expect(settings.maxPercent).toBe(50);
			expect(settings.enableSplitting).toBe(true);
			expect(settings.defaultRecipientType).toBe("driver");
		});

		it("preserves unchanged settings", async () => {
			await controller.updateSettings({
				maxAmount: 2000,
			});
			const settings = await controller.getSettings();
			expect(settings.maxAmount).toBe(2000);
			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.allowCustom).toBe(true);
		});
	});

	// ── getTipStats ─────────────────────────────────────────────────────

	describe("getTipStats", () => {
		it("returns zeroes when no tips exist", async () => {
			const stats = await controller.getTipStats();
			expect(stats.totalTips).toBe(0);
			expect(stats.totalAmount).toBe(0);
			expect(stats.averageTip).toBe(0);
		});

		it("aggregates tip stats correctly", async () => {
			const t1 = await controller.addTip({
				orderId: "ord_1",
				amount: 500,
				type: "preset",
			});
			await controller.addTip({
				orderId: "ord_2",
				amount: 300,
				type: "custom",
			});
			const t3 = await controller.addTip({
				orderId: "ord_3",
				amount: 200,
				type: "preset",
			});

			await controller.updateTip(t1.id, { status: "paid" });
			await controller.updateTip(t3.id, { status: "refunded" });

			const stats = await controller.getTipStats();
			expect(stats.totalTips).toBe(3);
			expect(stats.totalAmount).toBe(1000);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalPaid).toBe(1);
			expect(stats.totalRefunded).toBe(1);
			expect(stats.averageTip).toBeCloseTo(333.33, 0);
		});

		it("includes payout stats", async () => {
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

			const stats = await controller.getTipStats();
			expect(stats.totalPayouts).toBe(2);
			expect(stats.totalPayoutAmount).toBe(8000);
		});
	});

	// ── full lifecycle ──────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("add tips -> split -> total -> payout", async () => {
			// Add tips to an order
			const tip1 = await controller.addTip({
				orderId: "ord_lifecycle",
				amount: 1000,
				percentage: 20,
				type: "preset",
				customerId: "cust_1",
			});
			await controller.addTip({
				orderId: "ord_lifecycle",
				amount: 500,
				type: "custom",
				customerId: "cust_1",
				recipientType: "server",
			});

			// Check total
			let total = await controller.getTipTotal("ord_lifecycle");
			expect(total).toBe(1500);

			// Split the first tip
			const splits = await controller.splitTip(tip1.id, [
				{ recipientType: "driver", amount: 600 },
				{ recipientType: "store", amount: 400 },
			]);
			expect(splits).toHaveLength(2);

			// Total should now be 600 + 400 + 500 = 1500
			total = await controller.getTipTotal("ord_lifecycle");
			expect(total).toBe(1500);

			// Mark all as paid
			const allTips = await controller.listTips({
				orderId: "ord_lifecycle",
			});
			for (const t of allTips) {
				await controller.updateTip(t.id, { status: "paid" });
			}

			// Create payout
			const payout = await controller.createPayout({
				recipientId: "driver_1",
				recipientType: "driver",
				amount: 600,
				tipCount: 1,
				periodStart: new Date("2026-03-01"),
				periodEnd: new Date("2026-03-16"),
			});
			expect(payout.status).toBe("pending");

			// Stats
			const stats = await controller.getTipStats();
			expect(stats.totalPaid).toBe(3);
			expect(stats.totalPayouts).toBe(1);
		});
	});
});
