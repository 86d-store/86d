import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTippingController } from "../service-impl";

/**
 * Store endpoint integration tests for the tipping module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-settings: returns tip configuration (presets, limits)
 * 2. add-tip: adds a tip to an order
 * 3. get-tip-total: returns total tips for an order
 * 4. update-tip: updates amount/percentage; 401 without auth; 404 if not owner
 * 5. remove-tip: removes tip; 401 without auth; 404 if not owner
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetSettings(data: DataService) {
	const controller = createTippingController(data);
	const settings = await controller.getSettings();
	return { settings };
}

async function simulateAddTip(
	data: DataService,
	body: {
		orderId: string;
		amount: number;
		type: "preset" | "custom";
		percentage?: number;
	},
) {
	const controller = createTippingController(data);
	const tip = await controller.addTip(body);
	return { tip };
}

async function simulateGetTipTotal(data: DataService, orderId: string) {
	const controller = createTippingController(data);
	const total = await controller.getTipTotal(orderId);
	return { total };
}

async function simulateUpdateTip(
	data: DataService,
	tipId: string,
	body: { amount?: number; percentage?: number },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTippingController(data);
	const existing = await controller.getTip(tipId);
	if (!existing || existing.customerId !== opts.customerId) {
		return { error: "Tip not found", status: 404 };
	}
	const tip = await controller.updateTip(tipId, body);
	if (!tip) return { error: "Tip not found", status: 404 };
	return { tip };
}

async function simulateRemoveTip(
	data: DataService,
	tipId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTippingController(data);
	const existing = await controller.getTip(tipId);
	if (!existing || existing.customerId !== opts.customerId) {
		return { error: "Tip not found", status: 404 };
	}
	const removed = await controller.removeTip(tipId);
	if (!removed) return { error: "Tip not found", status: 404 };
	return { success: true };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get settings — tip configuration", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns default tip settings", async () => {
		const result = await simulateGetSettings(data);

		expect("settings" in result).toBe(true);
		expect(result.settings).toBeDefined();
	});

	it("returns updated settings after configuration", async () => {
		const ctrl = createTippingController(data);
		await ctrl.updateSettings({
			presetPercents: [10, 15, 20, 25],
			allowCustom: true,
			maxAmount: 10000,
		});

		const result = await simulateGetSettings(data);

		expect(result.settings.presetPercents).toEqual([10, 15, 20, 25]);
		expect(result.settings.allowCustom).toBe(true);
	});
});

describe("store endpoint: add tip — tip an order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("adds a custom tip", async () => {
		const result = await simulateAddTip(data, {
			orderId: "order_1",
			amount: 500,
			type: "custom",
		});

		expect("tip" in result).toBe(true);
		if (!("tip" in result)) {
			throw new Error("expected 'tip' in result");
		}
		expect(result.tip.amount).toBe(500);
		expect(result.tip.orderId).toBe("order_1");
	});

	it("adds a preset tip", async () => {
		const result = await simulateAddTip(data, {
			orderId: "order_2",
			amount: 300,
			type: "preset",
			percentage: 15,
		});

		expect("tip" in result).toBe(true);
		if (!("tip" in result)) {
			throw new Error("expected 'tip' in result");
		}
		expect(result.tip.amount).toBe(300);
		expect(result.tip.type).toBe("preset");
	});
});

describe("store endpoint: get tip total — order tip summary", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns total tips for an order", async () => {
		const ctrl = createTippingController(data);
		await ctrl.addTip({ orderId: "order_1", amount: 300, type: "custom" });
		await ctrl.addTip({ orderId: "order_1", amount: 200, type: "custom" });

		const result = await simulateGetTipTotal(data, "order_1");

		expect(result.total).toBe(500);
	});

	it("returns zero for order with no tips", async () => {
		const result = await simulateGetTipTotal(data, "order_none");

		expect(result.total).toBe(0);
	});
});

describe("store endpoint: update tip — modify existing tip", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateUpdateTip(data, "tip_1", { amount: 500 });

		expect(result).toEqual({ error: "Authentication required", status: 401 });
	});

	it("updates tip amount", async () => {
		const ctrl = createTippingController(data);
		const tip = await ctrl.addTip({
			orderId: "order_1",
			amount: 300,
			type: "custom",
			customerId: "cust_1",
		});

		const result = await simulateUpdateTip(
			data,
			tip.id,
			{ amount: 600 },
			{ customerId: "cust_1" },
		);

		expect("tip" in result).toBe(true);
		if (!("tip" in result)) {
			throw new Error("expected 'tip' in result");
		}
		expect(result.tip.amount).toBe(600);
	});

	it("returns 404 for nonexistent tip", async () => {
		const result = await simulateUpdateTip(
			data,
			"ghost_tip",
			{ amount: 500 },
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({ error: "Tip not found", status: 404 });
	});

	it("returns 404 when customer tries to update another customer's tip", async () => {
		const ctrl = createTippingController(data);
		const tip = await ctrl.addTip({
			orderId: "order_1",
			amount: 300,
			type: "custom",
			customerId: "cust_1",
		});

		const result = await simulateUpdateTip(
			data,
			tip.id,
			{ amount: 999 },
			{ customerId: "cust_2" },
		);

		expect(result).toEqual({ error: "Tip not found", status: 404 });
	});
});

describe("store endpoint: remove tip — delete an existing tip", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateRemoveTip(data, "tip_1");

		expect(result).toEqual({ error: "Authentication required", status: 401 });
	});

	it("removes own tip", async () => {
		const ctrl = createTippingController(data);
		const tip = await ctrl.addTip({
			orderId: "order_1",
			amount: 250,
			type: "custom",
			customerId: "cust_1",
		});

		const result = await simulateRemoveTip(data, tip.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ success: true });
	});

	it("returns 404 for nonexistent tip", async () => {
		const result = await simulateRemoveTip(data, "ghost_tip", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Tip not found", status: 404 });
	});

	it("returns 404 when customer tries to remove another customer's tip", async () => {
		const ctrl = createTippingController(data);
		const tip = await ctrl.addTip({
			orderId: "order_1",
			amount: 250,
			type: "custom",
			customerId: "cust_1",
		});

		const result = await simulateRemoveTip(data, tip.id, {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Tip not found", status: 404 });
	});
});
