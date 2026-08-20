import { describe, expect, it, vi } from "vitest";
import { createRule } from "../admin/endpoints/create-rule";
import { createTier } from "../admin/endpoints/create-tier";
import { deleteRule } from "../admin/endpoints/delete-rule";
import { deleteTier } from "../admin/endpoints/delete-tier";
import { getRule } from "../admin/endpoints/get-rule";
import { getTier } from "../admin/endpoints/get-tier";
import { listRules } from "../admin/endpoints/list-rules";
import { listTiers } from "../admin/endpoints/list-tiers";
import { previewTiers } from "../admin/endpoints/preview-tiers";
import { summary } from "../admin/endpoints/summary";
import { updateRule } from "../admin/endpoints/update-rule";
import { updateTier } from "../admin/endpoints/update-tier";
import type {
	BulkPricingController,
	BulkPricingSummary,
	DiscountType,
	PricingRule,
	PricingScope,
	PricingTier,
	TierPreview,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Bulk Discount",
		scope: "product" satisfies PricingScope,
		priority: 0,
		active: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTier(overrides: Partial<PricingTier> = {}): PricingTier {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		ruleId: "rule_1",
		minQuantity: 10,
		discountType: "percentage" satisfies DiscountType,
		discountValue: 10,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTierPreview(overrides: Partial<TierPreview> = {}): TierPreview {
	return {
		tier: makeTier(),
		unitPrice: 90,
		savingsPercent: 10,
		...overrides,
	};
}

function makeController(
	overrides: Partial<BulkPricingController> = {},
): BulkPricingController {
	return {
		createRule: vi.fn().mockResolvedValue(makeRule()),
		updateRule: vi.fn().mockResolvedValue(null),
		getRule: vi.fn().mockResolvedValue(null),
		listRules: vi.fn().mockResolvedValue([]),
		deleteRule: vi.fn().mockResolvedValue(false),
		createTier: vi.fn().mockResolvedValue(makeTier()),
		updateTier: vi.fn().mockResolvedValue(null),
		getTier: vi.fn().mockResolvedValue(null),
		listTiers: vi.fn().mockResolvedValue([]),
		deleteTier: vi.fn().mockResolvedValue(false),
		resolvePrice: vi.fn().mockResolvedValue({
			basePrice: 100,
			unitPrice: 100,
			discountPerUnit: 0,
			totalPrice: 100,
			matchedTier: null,
			matchedRule: null,
			hasDiscount: false,
		}),
		previewTiers: vi.fn().mockResolvedValue([]),
		getSummary: vi.fn().mockResolvedValue({
			totalRules: 0,
			activeRules: 0,
			totalTiers: 0,
			rulesByScope: {
				product: 0,
				variant: 0,
				collection: 0,
				global: 0,
			},
		} satisfies BulkPricingSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: BulkPricingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { bulkPricing: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listRulesHandler = extractHandler(listRules);
const createRuleHandler = extractHandler(createRule);
const getRuleHandler = extractHandler(getRule);
const updateRuleHandler = extractHandler(updateRule);
const deleteRuleHandler = extractHandler(deleteRule);
const previewTiersHandler = extractHandler(previewTiers);
const listTiersHandler = extractHandler(listTiers);
const createTierHandler = extractHandler(createTier);
const getTierHandler = extractHandler(getTier);
const updateTierHandler = extractHandler(updateTier);
const deleteTierHandler = extractHandler(deleteTier);
const summaryHandler = extractHandler(summary);

// ── listRules ─────────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/rules", () => {
	it("returns empty list when no rules", async () => {
		const result = (await call(listRulesHandler)) as { rules: PricingRule[] };
		expect(result.rules).toHaveLength(0);
	});

	it("returns rules from controller", async () => {
		const rules = [makeRule(), makeRule()];
		const ctrl = makeController({
			listRules: vi.fn().mockResolvedValue(rules),
		});
		const result = (await call(listRulesHandler, { controller: ctrl })) as {
			rules: PricingRule[];
		};
		expect(result.rules).toHaveLength(2);
	});

	it("forwards scope filter to controller", async () => {
		const ctrl = makeController();
		await call(listRulesHandler, {
			query: { scope: "product" },
			controller: ctrl,
		});
		expect(ctrl.listRules).toHaveBeenCalledWith(
			expect.objectContaining({ scope: "product" }),
		);
	});
});

// ── createRule ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/rules/create", () => {
	it("creates rule and returns it", async () => {
		const rule = makeRule({ name: "Volume Discount", scope: "collection" });
		const ctrl = makeController({
			createRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(createRuleHandler, {
			body: { name: "Volume Discount", scope: "collection" },
			controller: ctrl,
		})) as { rule: PricingRule };
		expect(result.rule.name).toBe("Volume Discount");
		expect(result.rule.scope).toBe("collection");
	});

	it("passes optional fields when provided", async () => {
		const ctrl = makeController();
		await call(createRuleHandler, {
			body: {
				name: "Product Deal",
				scope: "product",
				targetId: "prod_1",
				priority: 10,
				active: false,
			},
			controller: ctrl,
		});
		expect(ctrl.createRule).toHaveBeenCalledWith(
			expect.objectContaining({ targetId: "prod_1", priority: 10 }),
		);
	});
});

// ── getRule ───────────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/rules/:id", () => {
	it("returns null rule when not found", async () => {
		const result = (await call(getRuleHandler, {
			params: { id: "missing" },
		})) as { rule: PricingRule | null };
		expect(result.rule).toBeNull();
	});

	it("returns rule when found", async () => {
		const rule = makeRule({ id: "rule_1" });
		const ctrl = makeController({
			getRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(getRuleHandler, {
			params: { id: "rule_1" },
			controller: ctrl,
		})) as { rule: PricingRule };
		expect(result.rule.id).toBe("rule_1");
	});
});

// ── updateRule ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/rules/:id/update", () => {
	it("returns null rule when not found", async () => {
		const result = (await call(updateRuleHandler, {
			params: { id: "missing" },
			body: { active: false },
		})) as { rule: PricingRule | null };
		expect(result.rule).toBeNull();
	});

	it("updates rule and returns it", async () => {
		const rule = makeRule({ name: "Updated Rule", active: false });
		const ctrl = makeController({
			updateRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(updateRuleHandler, {
			params: { id: rule.id },
			body: { name: "Updated Rule", active: false },
			controller: ctrl,
		})) as { rule: PricingRule };
		expect(result.rule.name).toBe("Updated Rule");
		expect(result.rule.active).toBe(false);
	});
});

// ── deleteRule ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/rules/:id/delete", () => {
	it("returns deleted false when rule not found", async () => {
		const result = (await call(deleteRuleHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes rule and returns true", async () => {
		const ctrl = makeController({
			deleteRule: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRuleHandler, {
			params: { id: "rule_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── previewTiers ──────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/rules/:id/preview", () => {
	it("returns empty list when no tiers", async () => {
		const result = (await call(previewTiersHandler, {
			params: { id: "rule_1" },
			query: { basePrice: "100" },
		})) as { tiers: TierPreview[] };
		expect(result.tiers).toHaveLength(0);
	});

	it("returns tier previews from controller", async () => {
		const previews = [makeTierPreview(), makeTierPreview()];
		const ctrl = makeController({
			previewTiers: vi.fn().mockResolvedValue(previews),
		});
		const result = (await call(previewTiersHandler, {
			params: { id: "rule_1" },
			query: { basePrice: "100" },
			controller: ctrl,
		})) as { tiers: TierPreview[] };
		expect(result.tiers).toHaveLength(2);
		expect(result.tiers[0].unitPrice).toBe(90);
		expect(result.tiers[0].savingsPercent).toBe(10);
	});

	it("calls controller with correct ruleId and basePrice", async () => {
		const ctrl = makeController();
		await call(previewTiersHandler, {
			params: { id: "rule_42" },
			query: { basePrice: "200" },
			controller: ctrl,
		});
		expect(ctrl.previewTiers).toHaveBeenCalledWith("rule_42", 200);
	});
});

// ── listTiers ─────────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/tiers", () => {
	it("returns empty list when no tiers", async () => {
		const result = (await call(listTiersHandler, {
			query: { ruleId: "rule_1" },
		})) as { tiers: PricingTier[] };
		expect(result.tiers).toHaveLength(0);
	});

	it("returns tiers for a rule", async () => {
		const tiers = [
			makeTier({ ruleId: "rule_1" }),
			makeTier({ ruleId: "rule_1" }),
		];
		const ctrl = makeController({
			listTiers: vi.fn().mockResolvedValue(tiers),
		});
		const result = (await call(listTiersHandler, {
			query: { ruleId: "rule_1" },
			controller: ctrl,
		})) as { tiers: PricingTier[] };
		expect(result.tiers).toHaveLength(2);
	});

	it("forwards ruleId to controller", async () => {
		const ctrl = makeController();
		await call(listTiersHandler, {
			query: { ruleId: "rule_99" },
			controller: ctrl,
		});
		expect(ctrl.listTiers).toHaveBeenCalledWith(
			expect.objectContaining({ ruleId: "rule_99" }),
		);
	});
});

// ── createTier ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/tiers/create", () => {
	it("creates tier and returns it", async () => {
		const tier = makeTier({
			ruleId: "rule_1",
			minQuantity: 5,
			discountType: "percentage",
			discountValue: 15,
		});
		const ctrl = makeController({
			createTier: vi.fn().mockResolvedValue(tier),
		});
		const result = (await call(createTierHandler, {
			body: {
				ruleId: "rule_1",
				minQuantity: 5,
				discountType: "percentage",
				discountValue: 15,
			},
			controller: ctrl,
		})) as { tier: PricingTier };
		expect(result.tier.minQuantity).toBe(5);
		expect(result.tier.discountValue).toBe(15);
	});

	it("passes optional maxQuantity and label when provided", async () => {
		const ctrl = makeController();
		await call(createTierHandler, {
			body: {
				ruleId: "rule_1",
				minQuantity: 10,
				maxQuantity: 49,
				discountType: "fixed_amount",
				discountValue: 500,
				label: "10–49 units",
			},
			controller: ctrl,
		});
		expect(ctrl.createTier).toHaveBeenCalledWith(
			expect.objectContaining({ maxQuantity: 49, label: "10–49 units" }),
		);
	});
});

// ── getTier ───────────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/tiers/:id", () => {
	it("returns null tier when not found", async () => {
		const result = (await call(getTierHandler, {
			params: { id: "missing" },
		})) as { tier: PricingTier | null };
		expect(result.tier).toBeNull();
	});

	it("returns tier when found", async () => {
		const tier = makeTier({ id: "tier_1" });
		const ctrl = makeController({
			getTier: vi.fn().mockResolvedValue(tier),
		});
		const result = (await call(getTierHandler, {
			params: { id: "tier_1" },
			controller: ctrl,
		})) as { tier: PricingTier };
		expect(result.tier.id).toBe("tier_1");
	});
});

// ── updateTier ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/tiers/:id/update", () => {
	it("returns null tier when not found", async () => {
		const result = (await call(updateTierHandler, {
			params: { id: "missing" },
			body: { discountValue: 20 },
		})) as { tier: PricingTier | null };
		expect(result.tier).toBeNull();
	});

	it("updates tier and returns it", async () => {
		const tier = makeTier({ discountValue: 20, discountType: "fixed_price" });
		const ctrl = makeController({
			updateTier: vi.fn().mockResolvedValue(tier),
		});
		const result = (await call(updateTierHandler, {
			params: { id: tier.id },
			body: { discountValue: 20, discountType: "fixed_price" },
			controller: ctrl,
		})) as { tier: PricingTier };
		expect(result.tier.discountValue).toBe(20);
		expect(result.tier.discountType).toBe("fixed_price");
	});
});

// ── deleteTier ────────────────────────────────────────────────────────────────

describe("admin POST /bulk-pricing/tiers/:id/delete", () => {
	it("returns deleted false when tier not found", async () => {
		const result = (await call(deleteTierHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes tier and returns true", async () => {
		const ctrl = makeController({
			deleteTier: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteTierHandler, {
			params: { id: "tier_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── summary ───────────────────────────────────────────────────────────────────

describe("admin GET /bulk-pricing/summary", () => {
	it("returns zero-state summary when no data", async () => {
		const result = (await call(summaryHandler)) as {
			summary: BulkPricingSummary;
		};
		expect(result.summary.totalRules).toBe(0);
		expect(result.summary.activeRules).toBe(0);
		expect(result.summary.totalTiers).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalRules: 8,
				activeRules: 6,
				totalTiers: 24,
				rulesByScope: {
					product: 4,
					variant: 2,
					collection: 1,
					global: 1,
				},
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: BulkPricingSummary;
		};
		expect(result.summary.totalRules).toBe(8);
		expect(result.summary.activeRules).toBe(6);
		expect(result.summary.totalTiers).toBe(24);
		expect(result.summary.rulesByScope.product).toBe(4);
	});
});
