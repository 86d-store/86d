import { describe, expect, it } from "vitest";
import tipping from "../index";

describe("tipping events", () => {
	it("declares expected event emits", () => {
		const mod = tipping();
		expect(mod.events?.emits).toContain("tip.added");
		expect(mod.events?.emits).toContain("tip.updated");
		expect(mod.events?.emits).toContain("tip.removed");
		expect(mod.events?.emits).toContain("tip.split");
		expect(mod.events?.emits).toContain("tip.payout.created");
	});

	it("has correct module id and version", () => {
		const mod = tipping();
		expect(mod.id).toBe("tipping");
		expect(mod.version).toBe("0.1.0");
	});

	it("includes relational storage with tip tables", () => {
		const mod = tipping();
		expect(mod.storage?.kind).toBe("relational");
		if (mod.storage?.kind !== "relational") return;
		expect(mod.storage.tables?.tip).toBeDefined();
		expect(mod.storage.tables?.tipPayout).toBeDefined();
		expect(mod.storage.tables?.tipSettings).toBeDefined();
	});

	it("declares admin pages", () => {
		const mod = tipping();
		expect(mod.admin?.pages).toHaveLength(2);
		expect(mod.admin?.pages?.[0]?.path).toBe("/admin/tipping");
		expect(mod.admin?.pages?.[0]?.group).toBe("Sales");
		expect(mod.admin?.pages?.[1]?.path).toBe("/admin/tipping/payouts");
		expect(mod.admin?.pages?.[1]?.group).toBe("Sales");
	});

	it("passes options through", () => {
		const mod = tipping({
			defaultPercents: "10,15,20",
			allowCustomAmount: "true",
			maxTipPercent: "50",
			enableTipSplitting: "true",
		});
		expect(mod.options).toEqual({
			defaultPercents: "10,15,20",
			allowCustomAmount: "true",
			maxTipPercent: "50",
			enableTipSplitting: "true",
		});
	});
});
