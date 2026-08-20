import { describe, expect, it, vi } from "vitest";
import { createPayout } from "../admin/endpoints/create-payout";
import { getSettings } from "../admin/endpoints/get-settings";
import { getTip } from "../admin/endpoints/get-tip";
import { listPayouts } from "../admin/endpoints/list-payouts";
import { listTips } from "../admin/endpoints/list-tips";
import { splitTip } from "../admin/endpoints/split-tip";
import { getTipStats } from "../admin/endpoints/stats";
import { updateSettings } from "../admin/endpoints/update-settings";
import type {
	Tip,
	TipPayout,
	TippingController,
	TipSettings,
	TipStats,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeTip(overrides: Partial<Tip> = {}): Tip {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order_1",
		amount: 500,
		type: "preset",
		recipientType: "staff",
		status: "pending",
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePayout(overrides: Partial<TipPayout> = {}): TipPayout {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		recipientId: "staff_1",
		recipientType: "staff",
		amount: 2500,
		tipCount: 5,
		periodStart: now,
		periodEnd: now,
		status: "pending",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSettings(overrides: Partial<TipSettings> = {}): TipSettings {
	return {
		id: "default",
		presetPercents: [10, 15, 20],
		allowCustom: true,
		maxPercent: 30,
		maxAmount: 5000,
		enableSplitting: false,
		defaultRecipientType: "staff",
		updatedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<TippingController> = {},
): TippingController {
	return {
		addTip: vi.fn().mockResolvedValue(makeTip()),
		updateTip: vi.fn().mockResolvedValue(null),
		removeTip: vi.fn().mockResolvedValue(false),
		getTip: vi.fn().mockResolvedValue(null),
		listTips: vi.fn().mockResolvedValue([]),
		splitTip: vi.fn().mockResolvedValue([]),
		getTipTotal: vi.fn().mockResolvedValue(0),
		createPayout: vi.fn().mockResolvedValue(makePayout()),
		getPayout: vi.fn().mockResolvedValue(null),
		listPayouts: vi.fn().mockResolvedValue([]),
		getSettings: vi.fn().mockResolvedValue(makeSettings()),
		updateSettings: vi.fn().mockResolvedValue(makeSettings()),
		getTipStats: vi.fn().mockResolvedValue({
			totalTips: 0,
			totalAmount: 0,
			totalPending: 0,
			totalPaid: 0,
			totalRefunded: 0,
			averageTip: 0,
			totalPayouts: 0,
			totalPayoutAmount: 0,
		} satisfies TipStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: TippingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { tipping: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createPayoutHandler = extractHandler(createPayout);
const getSettingsHandler = extractHandler(getSettings);
const getTipHandler = extractHandler(getTip);
const getTipStatsHandler = extractHandler(getTipStats);
const listPayoutsHandler = extractHandler(listPayouts);
const listTipsHandler = extractHandler(listTips);
const splitTipHandler = extractHandler(splitTip);
const updateSettingsHandler = extractHandler(updateSettings);

// ── admin POST /tipping/payouts ───────────────────────────────────────────────

describe("admin POST /tipping/payouts", () => {
	it("creates a payout and returns it", async () => {
		const payout = makePayout({ recipientId: "staff_2", amount: 3000 });
		const ctrl = makeController({
			createPayout: vi.fn().mockResolvedValue(payout),
		});
		const result = (await call(createPayoutHandler, {
			body: {
				recipientId: "staff_2",
				recipientType: "staff",
				amount: 3000,
				tipCount: 6,
				periodStart: new Date().toISOString(),
				periodEnd: new Date().toISOString(),
			},
			controller: ctrl,
		})) as { payout: TipPayout };
		expect(result.payout.recipientId).toBe("staff_2");
		expect(result.payout.amount).toBe(3000);
		expect(ctrl.createPayout).toHaveBeenCalledWith(
			expect.objectContaining({ recipientId: "staff_2", amount: 3000 }),
		);
	});

	it("forwards all required payout fields to controller", async () => {
		const ctrl = makeController();
		await call(createPayoutHandler, {
			body: {
				recipientId: "staff_3",
				recipientType: "driver",
				amount: 1200,
				tipCount: 3,
				periodStart: new Date().toISOString(),
				periodEnd: new Date().toISOString(),
			},
			controller: ctrl,
		});
		expect(ctrl.createPayout).toHaveBeenCalledWith(
			expect.objectContaining({ recipientType: "driver", tipCount: 3 }),
		);
	});
});

// ── admin GET /tipping/settings ───────────────────────────────────────────────

describe("admin GET /tipping/settings", () => {
	it("returns settings from controller", async () => {
		const settings = makeSettings({ presetPercents: [10, 18, 25] });
		const ctrl = makeController({
			getSettings: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(getSettingsHandler, {
			controller: ctrl,
		})) as { settings: TipSettings };
		expect(result.settings.presetPercents).toEqual([10, 18, 25]);
		expect(ctrl.getSettings).toHaveBeenCalled();
	});

	it("returns default settings with zero state", async () => {
		const result = (await call(getSettingsHandler)) as {
			settings: TipSettings;
		};
		expect(result.settings).toHaveProperty("presetPercents");
		expect(result.settings).toHaveProperty("allowCustom");
		expect(result.settings).toHaveProperty("maxPercent");
	});
});

// ── admin GET /tipping/tips/:id ───────────────────────────────────────────────

describe("admin GET /tipping/tips/:id", () => {
	it("returns 404 when tip not found", async () => {
		const result = (await call(getTipHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns tip when found", async () => {
		const tip = makeTip({ id: "tip_1", amount: 750 });
		const ctrl = makeController({
			getTip: vi.fn().mockResolvedValue(tip),
		});
		const result = (await call(getTipHandler, {
			params: { id: "tip_1" },
			controller: ctrl,
		})) as { tip: Tip };
		expect(result.tip.id).toBe("tip_1");
		expect(result.tip.amount).toBe(750);
		expect(ctrl.getTip).toHaveBeenCalledWith("tip_1");
	});
});

// ── admin GET /tipping/payouts ────────────────────────────────────────────────

describe("admin GET /tipping/payouts", () => {
	it("returns empty list when no payouts exist", async () => {
		const result = (await call(listPayoutsHandler)) as {
			payouts: TipPayout[];
			total: number;
		};
		expect(result.payouts).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns payouts from controller", async () => {
		const payouts = [makePayout(), makePayout({ recipientId: "staff_2" })];
		const ctrl = makeController({
			listPayouts: vi.fn().mockResolvedValue(payouts),
		});
		const result = (await call(listPayoutsHandler, {
			controller: ctrl,
		})) as { payouts: TipPayout[]; total: number };
		expect(result.payouts).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── admin GET /tipping/tips ───────────────────────────────────────────────────

describe("admin GET /tipping/tips", () => {
	it("returns empty list when no tips exist", async () => {
		const result = (await call(listTipsHandler)) as {
			tips: Tip[];
			total: number;
		};
		expect(result.tips).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns tips from controller", async () => {
		const tips = [makeTip(), makeTip({ orderId: "order_2" })];
		const ctrl = makeController({
			listTips: vi.fn().mockResolvedValue(tips),
		});
		const result = (await call(listTipsHandler, {
			controller: ctrl,
		})) as { tips: Tip[]; total: number };
		expect(result.tips).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listTipsHandler, {
			query: { status: "paid" },
			controller: ctrl,
		});
		expect(ctrl.listTips).toHaveBeenCalledWith(
			expect.objectContaining({ status: "paid" }),
		);
	});
});

// ── admin POST /tipping/tips/:id/split ───────────────────────────────────────

describe("admin POST /tipping/tips/:id/split", () => {
	it("returns 404 when tip not found", async () => {
		const result = (await call(splitTipHandler, {
			params: { id: "missing" },
			body: {
				splits: [
					{ recipientType: "staff", recipientId: "staff_1", amount: 300 },
					{ recipientType: "staff", recipientId: "staff_2", amount: 200 },
				],
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("splits tip and returns resulting tips", async () => {
		const tip = makeTip({ id: "tip_2" });
		const splits = [makeTip(), makeTip()];
		const ctrl = makeController({
			getTip: vi.fn().mockResolvedValue(tip),
			splitTip: vi.fn().mockResolvedValue(splits),
		});
		const result = (await call(splitTipHandler, {
			params: { id: "tip_2" },
			body: {
				splits: [
					{ recipientType: "staff", recipientId: "staff_1", amount: 300 },
					{ recipientType: "staff", recipientId: "staff_2", amount: 200 },
				],
			},
			controller: ctrl,
		})) as { tips: Tip[] };
		expect(result.tips).toHaveLength(2);
		expect(ctrl.splitTip).toHaveBeenCalledWith(
			"tip_2",
			expect.arrayContaining([
				expect.objectContaining({ recipientId: "staff_1", amount: 300 }),
			]),
		);
	});
});

// ── admin GET /tipping/stats ──────────────────────────────────────────────────

describe("admin GET /tipping/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getTipStatsHandler)) as { stats: TipStats };
		expect(result.stats.totalTips).toBe(0);
		expect(result.stats.totalAmount).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getTipStats: vi.fn().mockResolvedValue({
				totalTips: 50,
				totalAmount: 25000,
				totalPending: 5000,
				totalPaid: 18000,
				totalRefunded: 2000,
				averageTip: 500,
				totalPayouts: 10,
				totalPayoutAmount: 18000,
			}),
		});
		const result = (await call(getTipStatsHandler, {
			controller: ctrl,
		})) as { stats: TipStats };
		expect(result.stats.totalTips).toBe(50);
		expect(result.stats.totalAmount).toBe(25000);
		expect(result.stats.averageTip).toBe(500);
	});
});

// ── admin PUT /tipping/settings ───────────────────────────────────────────────

describe("admin PUT /tipping/settings", () => {
	it("updates settings and returns them", async () => {
		const updated = makeSettings({ allowCustom: false, maxPercent: 25 });
		const ctrl = makeController({
			updateSettings: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateSettingsHandler, {
			body: { allowCustom: false, maxPercent: 25 },
			controller: ctrl,
		})) as { settings: TipSettings };
		expect(result.settings.allowCustom).toBe(false);
		expect(result.settings.maxPercent).toBe(25);
		expect(ctrl.updateSettings).toHaveBeenCalledWith(
			expect.objectContaining({ allowCustom: false, maxPercent: 25 }),
		);
	});

	it("forwards preset percents update to controller", async () => {
		const ctrl = makeController();
		await call(updateSettingsHandler, {
			body: { presetPercents: [5, 10, 15, 20] },
			controller: ctrl,
		});
		expect(ctrl.updateSettings).toHaveBeenCalledWith(
			expect.objectContaining({ presetPercents: [5, 10, 15, 20] }),
		);
	});
});
