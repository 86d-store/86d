import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTippingController } from "../service-impl";

describe("tipping service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTippingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTippingController(mockData);
	});

	// ── addTip ───────────────────────────────────────────────────────

	describe("addTip", () => {
		it("creates a tip with pending status", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 500,
				type: "preset",
				percentage: 20,
			});

			expect(tip.orderId).toBe("order-1");
			expect(tip.amount).toBe(500);
			expect(tip.percentage).toBe(20);
			expect(tip.type).toBe("preset");
			expect(tip.status).toBe("pending");
			expect(tip.id).toBeTruthy();
			expect(tip.createdAt).toBeInstanceOf(Date);
		});

		it("uses default recipient type from settings", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "custom",
			});

			expect(tip.recipientType).toBe("store");
		});

		it("respects explicit recipient type", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "custom",
				recipientType: "driver",
			});

			expect(tip.recipientType).toBe("driver");
		});

		it("stores customer and recipient IDs", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 200,
				type: "preset",
				recipientId: "emp-1",
				customerId: "cust-1",
			});

			expect(tip.recipientId).toBe("emp-1");
			expect(tip.customerId).toBe("cust-1");
		});

		it("stores metadata", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 200,
				type: "preset",
				metadata: { source: "checkout" },
			});

			expect(tip.metadata).toEqual({ source: "checkout" });
		});

		it("defaults metadata to empty object", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 200,
				type: "preset",
			});

			expect(tip.metadata).toEqual({});
		});

		it("persists tip to data store", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "custom",
			});

			expect(mockData.size("tip")).toBe(1);
			const stored = await mockData.get("tip", tip.id);
			expect(stored).not.toBeNull();
		});
	});

	// ── updateTip ────────────────────────────────────────────────────

	describe("updateTip", () => {
		it("updates amount", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const updated = await controller.updateTip(tip.id, { amount: 500 });
			expect(updated?.amount).toBe(500);
		});

		it("updates status to paid and sets paidAt", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const updated = await controller.updateTip(tip.id, { status: "paid" });
			expect(updated?.status).toBe("paid");
			expect(updated?.paidAt).toBeInstanceOf(Date);
		});

		it("updates recipient type", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const updated = await controller.updateTip(tip.id, {
				recipientType: "server",
			});
			expect(updated?.recipientType).toBe("server");
		});

		it("returns null for nonexistent tip", async () => {
			const result = await controller.updateTip("nonexistent", { amount: 100 });
			expect(result).toBeNull();
		});

		it("preserves unchanged fields", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
				percentage: 20,
			});

			const updated = await controller.updateTip(tip.id, { amount: 500 });
			expect(updated?.orderId).toBe("order-1");
			expect(updated?.type).toBe("preset");
			expect(updated?.percentage).toBe(20);
		});

		it("updates updatedAt timestamp", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const updated = await controller.updateTip(tip.id, { amount: 500 });
			expect(updated?.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── removeTip ────────────────────────────────────────────────────

	describe("removeTip", () => {
		it("removes an existing tip", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const result = await controller.removeTip(tip.id);
			expect(result).toBe(true);
			expect(mockData.size("tip")).toBe(0);
		});

		it("returns false for nonexistent tip", async () => {
			const result = await controller.removeTip("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── getTip / listTips ────────────────────────────────────────────

	describe("getTip", () => {
		it("returns null for missing tip", async () => {
			expect(await controller.getTip("nonexistent")).toBeNull();
		});

		it("returns stored tip", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});

			const fetched = await controller.getTip(tip.id);
			expect(fetched?.id).toBe(tip.id);
			expect(fetched?.amount).toBe(300);
		});
	});

	describe("listTips", () => {
		it("lists all tips", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 500,
				type: "custom",
			});

			const tips = await controller.listTips();
			expect(tips).toHaveLength(2);
		});

		it("filters by orderId", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 500,
				type: "custom",
			});

			const tips = await controller.listTips({ orderId: "order-1" });
			expect(tips).toHaveLength(1);
			expect(tips[0].orderId).toBe("order-1");
		});

		it("filters by status", async () => {
			const tip = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 500,
				type: "custom",
			});
			await controller.updateTip(tip.id, { status: "paid" });

			const paid = await controller.listTips({ status: "paid" });
			expect(paid).toHaveLength(1);
			expect(paid[0].status).toBe("paid");
		});

		it("filters by recipientId", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
				recipientId: "emp-1",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 500,
				type: "custom",
				recipientId: "emp-2",
			});

			const tips = await controller.listTips({ recipientId: "emp-1" });
			expect(tips).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 100,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 200,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-3",
				amount: 300,
				type: "preset",
			});

			const page = await controller.listTips({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── splitTip ─────────────────────────────────────────────────────

	describe("splitTip", () => {
		it("splits a tip into multiple tips", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "custom",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "server", recipientId: "emp-1", amount: 600 },
				{ recipientType: "driver", recipientId: "emp-2", amount: 400 },
			]);

			expect(splits).toHaveLength(2);
			expect(splits[0].amount).toBe(600);
			expect(splits[0].recipientType).toBe("server");
			expect(splits[1].amount).toBe(400);
			expect(splits[1].recipientType).toBe("driver");
		});

		it("removes the original tip after splitting", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "custom",
			});

			await controller.splitTip(original.id, [
				{ recipientType: "server", amount: 600 },
				{ recipientType: "driver", amount: 400 },
			]);

			const originalFetched = await controller.getTip(original.id);
			expect(originalFetched).toBeNull();
		});

		it("preserves original order and customer info in splits", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "preset",
				customerId: "cust-1",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "server", amount: 500 },
				{ recipientType: "staff", amount: 500 },
			]);

			for (const split of splits) {
				expect(split.orderId).toBe("order-1");
				expect(split.customerId).toBe("cust-1");
				expect(split.type).toBe("preset");
			}
		});

		it("sets splitFrom in metadata", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "custom",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "server", amount: 1000 },
			]);

			expect(splits[0].metadata.splitFrom).toBe(original.id);
		});

		it("preserves original metadata in splits", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "custom",
				metadata: { source: "checkout", note: "great service" },
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "server", amount: 1000 },
			]);

			expect(splits[0].metadata.source).toBe("checkout");
			expect(splits[0].metadata.note).toBe("great service");
			expect(splits[0].metadata.splitFrom).toBe(original.id);
		});

		it("returns empty array for nonexistent tip", async () => {
			const splits = await controller.splitTip("nonexistent", [
				{ recipientType: "server", amount: 500 },
			]);
			expect(splits).toHaveLength(0);
		});

		it("sets all splits to pending status", async () => {
			const original = await controller.addTip({
				orderId: "order-1",
				amount: 1000,
				type: "custom",
			});

			const splits = await controller.splitTip(original.id, [
				{ recipientType: "server", amount: 600 },
				{ recipientType: "driver", amount: 400 },
			]);

			for (const split of splits) {
				expect(split.status).toBe("pending");
			}
		});
	});

	// ── getTipTotal ──────────────────────────────────────────────────

	describe("getTipTotal", () => {
		it("returns 0 when no tips for order", async () => {
			const total = await controller.getTipTotal("order-1");
			expect(total).toBe(0);
		});

		it("sums all non-refunded tips for an order", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-1",
				amount: 200,
				type: "custom",
			});

			const total = await controller.getTipTotal("order-1");
			expect(total).toBe(500);
		});

		it("excludes refunded tips", async () => {
			const tip1 = await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-1",
				amount: 200,
				type: "custom",
			});
			await controller.updateTip(tip1.id, { status: "refunded" });

			const total = await controller.getTipTotal("order-1");
			expect(total).toBe(200);
		});

		it("does not include tips from other orders", async () => {
			await controller.addTip({
				orderId: "order-1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "order-2",
				amount: 500,
				type: "custom",
			});

			const total = await controller.getTipTotal("order-1");
			expect(total).toBe(300);
		});
	});

	// ── createPayout / getPayout / listPayouts ───────────────────────

	describe("createPayout", () => {
		it("creates a payout with pending status", async () => {
			const now = new Date();
			const payout = await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
				periodEnd: now,
			});

			expect(payout.recipientId).toBe("emp-1");
			expect(payout.amount).toBe(5000);
			expect(payout.tipCount).toBe(10);
			expect(payout.status).toBe("pending");
			expect(payout.id).toBeTruthy();
		});

		it("stores reference when provided", async () => {
			const now = new Date();
			const payout = await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: now,
				periodEnd: now,
				reference: "PAY-2026-001",
			});

			expect(payout.reference).toBe("PAY-2026-001");
		});
	});

	describe("getPayout", () => {
		it("returns null for missing payout", async () => {
			expect(await controller.getPayout("nonexistent")).toBeNull();
		});

		it("returns stored payout", async () => {
			const now = new Date();
			const payout = await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: now,
				periodEnd: now,
			});

			const fetched = await controller.getPayout(payout.id);
			expect(fetched?.id).toBe(payout.id);
		});
	});

	describe("listPayouts", () => {
		it("lists all payouts", async () => {
			const now = new Date();
			await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: now,
				periodEnd: now,
			});
			await controller.createPayout({
				recipientId: "emp-2",
				recipientType: "driver",
				amount: 3000,
				tipCount: 5,
				periodStart: now,
				periodEnd: now,
			});

			const payouts = await controller.listPayouts();
			expect(payouts).toHaveLength(2);
		});

		it("filters by recipientId", async () => {
			const now = new Date();
			await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: now,
				periodEnd: now,
			});
			await controller.createPayout({
				recipientId: "emp-2",
				recipientType: "driver",
				amount: 3000,
				tipCount: 5,
				periodStart: now,
				periodEnd: now,
			});

			const filtered = await controller.listPayouts({ recipientId: "emp-1" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].recipientId).toBe("emp-1");
		});
	});

	// ── getSettings / updateSettings ─────────────────────────────────

	describe("getSettings", () => {
		it("returns default settings on first call", async () => {
			const settings = await controller.getSettings();

			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.allowCustom).toBe(true);
			expect(settings.maxPercent).toBe(100);
			expect(settings.maxAmount).toBe(1000);
			expect(settings.enableSplitting).toBe(false);
			expect(settings.defaultRecipientType).toBe("store");
		});

		it("persists default settings to data store", async () => {
			await controller.getSettings();

			expect(mockData.size("tipSettings")).toBe(1);
		});

		it("returns previously saved settings", async () => {
			await controller.updateSettings({ presetPercents: [10, 15, 20] });

			const settings = await controller.getSettings();
			expect(settings.presetPercents).toEqual([10, 15, 20]);
		});
	});

	describe("updateSettings", () => {
		it("updates preset percents", async () => {
			const updated = await controller.updateSettings({
				presetPercents: [10, 15, 20],
			});

			expect(updated.presetPercents).toEqual([10, 15, 20]);
		});

		it("updates multiple fields at once", async () => {
			const updated = await controller.updateSettings({
				allowCustom: false,
				maxPercent: 50,
				maxAmount: 500,
				enableSplitting: true,
				defaultRecipientType: "server",
			});

			expect(updated.allowCustom).toBe(false);
			expect(updated.maxPercent).toBe(50);
			expect(updated.maxAmount).toBe(500);
			expect(updated.enableSplitting).toBe(true);
			expect(updated.defaultRecipientType).toBe("server");
		});

		it("preserves unchanged fields", async () => {
			await controller.updateSettings({ maxAmount: 2000 });

			const settings = await controller.getSettings();
			expect(settings.presetPercents).toEqual([15, 18, 20, 25]);
			expect(settings.allowCustom).toBe(true);
			expect(settings.maxAmount).toBe(2000);
		});

		it("updates updatedAt", async () => {
			const updated = await controller.updateSettings({
				maxAmount: 2000,
			});

			expect(updated.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── getTipStats ──────────────────────────────────────────────────

	describe("getTipStats", () => {
		it("returns zeroed stats when no data", async () => {
			const stats = await controller.getTipStats();

			expect(stats.totalTips).toBe(0);
			expect(stats.totalAmount).toBe(0);
			expect(stats.totalPending).toBe(0);
			expect(stats.totalPaid).toBe(0);
			expect(stats.totalRefunded).toBe(0);
			expect(stats.averageTip).toBe(0);
			expect(stats.totalPayouts).toBe(0);
			expect(stats.totalPayoutAmount).toBe(0);
		});

		it("counts tips by status", async () => {
			const t1 = await controller.addTip({
				orderId: "o1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "o2",
				amount: 500,
				type: "custom",
			});
			const t3 = await controller.addTip({
				orderId: "o3",
				amount: 200,
				type: "preset",
			});

			await controller.updateTip(t1.id, { status: "paid" });
			await controller.updateTip(t3.id, { status: "refunded" });

			const stats = await controller.getTipStats();
			expect(stats.totalTips).toBe(3);
			expect(stats.totalPaid).toBe(1);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalRefunded).toBe(1);
		});

		it("calculates total amount and average", async () => {
			await controller.addTip({
				orderId: "o1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "o2",
				amount: 500,
				type: "custom",
			});
			await controller.addTip({
				orderId: "o3",
				amount: 200,
				type: "preset",
			});

			const stats = await controller.getTipStats();
			expect(stats.totalAmount).toBe(1000);
			expect(stats.averageTip).toBeCloseTo(333.33, 1);
		});

		it("includes payout totals", async () => {
			const now = new Date();
			await controller.createPayout({
				recipientId: "emp-1",
				recipientType: "server",
				amount: 5000,
				tipCount: 10,
				periodStart: now,
				periodEnd: now,
			});
			await controller.createPayout({
				recipientId: "emp-2",
				recipientType: "driver",
				amount: 3000,
				tipCount: 5,
				periodStart: now,
				periodEnd: now,
			});

			const stats = await controller.getTipStats();
			expect(stats.totalPayouts).toBe(2);
			expect(stats.totalPayoutAmount).toBe(8000);
		});

		it("includes all tip amounts regardless of status in totalAmount", async () => {
			const t1 = await controller.addTip({
				orderId: "o1",
				amount: 300,
				type: "preset",
			});
			await controller.addTip({
				orderId: "o2",
				amount: 500,
				type: "custom",
			});
			await controller.updateTip(t1.id, { status: "refunded" });

			const stats = await controller.getTipStats();
			// totalAmount includes refunded tips (it tracks total volume)
			expect(stats.totalAmount).toBe(800);
		});
	});
});
