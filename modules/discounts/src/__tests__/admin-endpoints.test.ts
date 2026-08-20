import { describe, expect, it, vi } from "vitest";
import { adminCodeStats } from "../admin/endpoints/code-stats";
import { adminCreateCode } from "../admin/endpoints/create-code";
import { adminCreateDiscount } from "../admin/endpoints/create-discount";
import { adminCreatePriceRule } from "../admin/endpoints/create-price-rule";
import { adminDeleteCode } from "../admin/endpoints/delete-code";
import { adminDeleteDiscount } from "../admin/endpoints/delete-discount";
import { adminDeletePriceRule } from "../admin/endpoints/delete-price-rule";
import { adminDiscountAnalytics } from "../admin/endpoints/discount-analytics";
import { adminGenerateCodes } from "../admin/endpoints/generate-codes";
import { adminGetDiscount } from "../admin/endpoints/get-discount";
import { adminGetPriceRule } from "../admin/endpoints/get-price-rule";
import { adminListDiscounts } from "../admin/endpoints/list-discounts";
import { adminListPriceRules } from "../admin/endpoints/list-price-rules";
import { adminUpdateCode } from "../admin/endpoints/update-code";
import { adminUpdateDiscount } from "../admin/endpoints/update-discount";
import { adminUpdatePriceRule } from "../admin/endpoints/update-price-rule";
import type {
	BulkCodeResult,
	CartPriceRule,
	CodeStats,
	Discount,
	DiscountAnalytics,
	DiscountCode,
	DiscountController,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeDiscount(overrides: Partial<Discount> = {}): Discount {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Summer Sale",
		type: "percentage",
		value: 10,
		usedCount: 0,
		isActive: true,
		appliesTo: "all",
		appliesToIds: [],
		stackable: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCode(
	discountId: string,
	overrides: Partial<DiscountCode> = {},
): DiscountCode {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		discountId,
		code: "SAVE10",
		usedCount: 0,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePriceRule(overrides: Partial<CartPriceRule> = {}): CartPriceRule {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Cart rule",
		type: "percentage",
		value: 5,
		conditions: [],
		appliesTo: "all",
		appliesToIds: [],
		priority: 0,
		stackable: false,
		usedCount: 0,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<DiscountController> = {},
): DiscountController {
	return {
		list: vi.fn().mockResolvedValue({ discounts: [], total: 0 }),
		create: vi.fn().mockResolvedValue(makeDiscount()),
		getById: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		createCode: vi.fn().mockResolvedValue(makeCode("d1")),
		updateCode: vi.fn().mockResolvedValue(null),
		deleteCode: vi.fn().mockResolvedValue(undefined),
		getCodeByValue: vi.fn().mockResolvedValue(null),
		listCodes: vi.fn().mockResolvedValue([]),
		generateBulkCodes: vi.fn().mockResolvedValue({
			generated: 0,
			codes: [],
		} satisfies BulkCodeResult),
		getCodeStats: vi.fn().mockResolvedValue({
			total: 0,
			active: 0,
			inactive: 0,
			totalRedemptions: 0,
			fullyUsed: 0,
			unused: 0,
			redemptionRate: 0,
		} satisfies CodeStats),
		getAnalytics: vi.fn().mockResolvedValue({
			totalDiscounts: 0,
			activeCount: 0,
			expiredCount: 0,
			scheduledCount: 0,
			totalUsage: 0,
			totalCodes: 0,
			typeDistribution: {},
			topByUsage: [],
		} satisfies DiscountAnalytics),
		createPriceRule: vi.fn().mockResolvedValue(makePriceRule()),
		getPriceRule: vi.fn().mockResolvedValue(null),
		updatePriceRule: vi.fn().mockResolvedValue(null),
		deletePriceRule: vi.fn().mockResolvedValue(undefined),
		listPriceRules: vi.fn().mockResolvedValue({ rules: [], total: 0 }),
		validateCode: vi.fn().mockResolvedValue({
			valid: false,
			discountAmount: 0,
			freeShipping: false,
		}),
		applyCode: vi.fn().mockResolvedValue({
			valid: false,
			discountAmount: 0,
			freeShipping: false,
		}),
		apply: vi.fn().mockResolvedValue({
			valid: false,
			discountAmount: 0,
			freeShipping: false,
		}),
		evaluateCartRules: vi.fn().mockResolvedValue({
			rules: [],
			totalDiscount: 0,
			freeShipping: false,
		}),
		applyPriceRules: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: DiscountController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { discount: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listDiscountsHandler = extractHandler(adminListDiscounts);
const createDiscountHandler = extractHandler(adminCreateDiscount);
const getDiscountHandler = extractHandler(adminGetDiscount);
const updateDiscountHandler = extractHandler(adminUpdateDiscount);
const deleteDiscountHandler = extractHandler(adminDeleteDiscount);
const createCodeHandler = extractHandler(adminCreateCode);
const updateCodeHandler = extractHandler(adminUpdateCode);
const deleteCodeHandler = extractHandler(adminDeleteCode);
const codeStatsHandler = extractHandler(adminCodeStats);
const generateCodesHandler = extractHandler(adminGenerateCodes);
const listPriceRulesHandler = extractHandler(adminListPriceRules);
const createPriceRuleHandler = extractHandler(adminCreatePriceRule);
const getPriceRuleHandler = extractHandler(adminGetPriceRule);
const updatePriceRuleHandler = extractHandler(adminUpdatePriceRule);
const deletePriceRuleHandler = extractHandler(adminDeletePriceRule);
const analyticsHandler = extractHandler(adminDiscountAnalytics);

// ── adminListDiscounts ────────────────────────────────────────────────────────

describe("admin GET /discounts", () => {
	it("returns empty list when no discounts exist", async () => {
		const result = (await call(listDiscountsHandler)) as {
			discounts: Discount[];
			total: number;
			page: number;
			pages: number;
		};
		expect(result.discounts).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
		expect(result.pages).toBe(0);
	});

	it("paginates with default page=1, limit=20", async () => {
		const discounts = Array.from({ length: 5 }, () => makeDiscount());
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue({ discounts, total: 5 }),
		});
		const result = (await call(listDiscountsHandler, {
			controller: ctrl,
		})) as { total: number; limit: number; page: number; pages: number };
		expect(result.total).toBe(5);
		expect(result.limit).toBe(20);
		expect(result.page).toBe(1);
		expect(result.pages).toBe(1);
		expect(ctrl.list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
	});

	it("passes isActive=true filter to controller", async () => {
		const ctrl = makeController();
		await call(listDiscountsHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});

	it("passes isActive=false filter to controller", async () => {
		const ctrl = makeController();
		await call(listDiscountsHandler, {
			query: { isActive: "false" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: false }),
		);
	});

	it("respects explicit page and limit params", async () => {
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue({ discounts: [], total: 50 }),
		});
		const result = (await call(listDiscountsHandler, {
			query: { page: "3", limit: "10" },
			controller: ctrl,
		})) as { page: number; limit: number; pages: number };
		expect(result.page).toBe(3);
		expect(result.limit).toBe(10);
		expect(result.pages).toBe(5);
		expect(ctrl.list).toHaveBeenCalledWith({ limit: 10, offset: 20 });
	});
});

// ── adminCreateDiscount ───────────────────────────────────────────────────────

describe("admin POST /discounts/create", () => {
	it("creates a percentage discount and returns it", async () => {
		const discount = makeDiscount({ type: "percentage", value: 15 });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(discount),
		});
		const result = (await call(createDiscountHandler, {
			body: { name: "Summer Sale", type: "percentage", value: 15 },
			controller: ctrl,
		})) as { discount: Discount };
		expect(result.discount.type).toBe("percentage");
		expect(result.discount.value).toBe(15);
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Summer Sale", type: "percentage" }),
		);
	});

	it("creates a fixed_amount discount", async () => {
		const discount = makeDiscount({ type: "fixed_amount", value: 500 });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(discount),
		});
		const result = (await call(createDiscountHandler, {
			body: { name: "5 Off", type: "fixed_amount", value: 500 },
			controller: ctrl,
		})) as { discount: Discount };
		expect(result.discount.type).toBe("fixed_amount");
	});

	it("creates a free_shipping discount", async () => {
		const discount = makeDiscount({ type: "free_shipping", value: 0 });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(discount),
		});
		const result = (await call(createDiscountHandler, {
			body: { name: "Free Ship", type: "free_shipping", value: 0 },
			controller: ctrl,
		})) as { discount: Discount };
		expect(result.discount.type).toBe("free_shipping");
	});
});

// ── adminGetDiscount ──────────────────────────────────────────────────────────

describe("admin GET /discounts/:id", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(getDiscountHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Discount not found");
	});

	it("returns discount with its codes", async () => {
		const discount = makeDiscount({ id: "d1" });
		const codes = [makeCode("d1", { code: "SAVE10" })];
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			listCodes: vi.fn().mockResolvedValue(codes),
		});
		const result = (await call(getDiscountHandler, {
			params: { id: "d1" },
			controller: ctrl,
		})) as { discount: Discount; codes: DiscountCode[] };
		expect(result.discount.id).toBe("d1");
		expect(result.codes).toHaveLength(1);
		expect(result.codes[0].code).toBe("SAVE10");
	});
});

// ── adminUpdateDiscount ───────────────────────────────────────────────────────

describe("admin PUT /discounts/:id/update", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(updateDiscountHandler, {
			params: { id: "missing" },
			body: { isActive: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated discount on success", async () => {
		const updated = makeDiscount({ isActive: false });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateDiscountHandler, {
			params: { id: updated.id },
			body: { isActive: false },
			controller: ctrl,
		})) as { discount: Discount };
		expect(result.discount.isActive).toBe(false);
		expect(ctrl.update).toHaveBeenCalledWith(
			updated.id,
			expect.objectContaining({ isActive: false }),
		);
	});

	it("forwards name update to controller", async () => {
		const updated = makeDiscount({ name: "New Name" });
		const ctrl = makeController({ update: vi.fn().mockResolvedValue(updated) });
		const result = (await call(updateDiscountHandler, {
			params: { id: updated.id },
			body: { name: "New Name" },
			controller: ctrl,
		})) as { discount: Discount };
		expect(result.discount.name).toBe("New Name");
	});
});

// ── adminDeleteDiscount ───────────────────────────────────────────────────────

describe("admin DELETE /discounts/:id/delete", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(deleteDiscountHandler, {
			params: { id: "gone" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes discount and returns success", async () => {
		const discount = makeDiscount({ id: "d2" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			delete: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteDiscountHandler, {
			params: { id: "d2" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("d2");
	});
});

// ── adminCreateCode ───────────────────────────────────────────────────────────

describe("admin POST /discounts/:id/codes", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(createCodeHandler, {
			params: { id: "missing" },
			body: { code: "NEW10" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns 400 when code already exists", async () => {
		const discount = makeDiscount({ id: "d1" });
		const existingCode = makeCode("d1", { code: "TAKEN" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			getCodeByValue: vi.fn().mockResolvedValue(existingCode),
		});
		const result = (await call(createCodeHandler, {
			params: { id: "d1" },
			body: { code: "TAKEN" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/already exists/i);
	});

	it("creates code when discount exists and code is unique", async () => {
		const discount = makeDiscount({ id: "d1" });
		const newCode = makeCode("d1", { code: "FRESH20" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			getCodeByValue: vi.fn().mockResolvedValue(null),
			createCode: vi.fn().mockResolvedValue(newCode),
		});
		const result = (await call(createCodeHandler, {
			params: { id: "d1" },
			body: { code: "FRESH20", maximumUses: 100, isActive: true },
			controller: ctrl,
		})) as { code: DiscountCode };
		expect(result.code.code).toBe("FRESH20");
		expect(ctrl.createCode).toHaveBeenCalledWith(
			expect.objectContaining({
				discountId: "d1",
				code: "FRESH20",
				maximumUses: 100,
				isActive: true,
			}),
		);
	});
});

// ── adminUpdateCode ───────────────────────────────────────────────────────────

describe("admin PUT /discounts/codes/:id/update", () => {
	it("returns 404 when code not found", async () => {
		const result = (await call(updateCodeHandler, {
			params: { id: "missing" },
			body: { isActive: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated code on success", async () => {
		const code = makeCode("d1", { isActive: false });
		const ctrl = makeController({
			updateCode: vi.fn().mockResolvedValue(code),
		});
		const result = (await call(updateCodeHandler, {
			params: { id: code.id },
			body: { isActive: false },
			controller: ctrl,
		})) as { code: DiscountCode };
		expect(result.code.isActive).toBe(false);
	});
});

// ── adminDeleteCode ───────────────────────────────────────────────────────────

describe("admin DELETE /discounts/codes/:id/delete", () => {
	it("deletes code and returns success", async () => {
		const ctrl = makeController({
			deleteCode: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteCodeHandler, {
			params: { id: "code-1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteCode).toHaveBeenCalledWith("code-1");
	});
});

// ── adminCodeStats ────────────────────────────────────────────────────────────

describe("admin GET /discounts/:id/code-stats", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(codeStatsHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns code stats for existing discount", async () => {
		const discount = makeDiscount({ id: "d3" });
		const stats: CodeStats = {
			total: 10,
			active: 8,
			inactive: 2,
			totalRedemptions: 45,
			fullyUsed: 1,
			unused: 5,
			redemptionRate: 45,
		};
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			getCodeStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(codeStatsHandler, {
			params: { id: "d3" },
			controller: ctrl,
		})) as CodeStats;
		expect(result.total).toBe(10);
		expect(result.active).toBe(8);
		expect(result.redemptionRate).toBe(45);
	});
});

// ── adminGenerateCodes ────────────────────────────────────────────────────────

describe("admin POST /discounts/:id/generate-codes", () => {
	it("returns 404 when discount not found", async () => {
		const result = (await call(generateCodesHandler, {
			params: { id: "missing" },
			body: { count: 5 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("generates bulk codes when discount exists", async () => {
		const discount = makeDiscount({ id: "d4" });
		const bulkResult: BulkCodeResult = {
			generated: 3,
			codes: [
				makeCode("d4", { code: "PREFIX_A1B2" }),
				makeCode("d4", { code: "PREFIX_C3D4" }),
				makeCode("d4", { code: "PREFIX_E5F6" }),
			],
		};
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(discount),
			generateBulkCodes: vi.fn().mockResolvedValue(bulkResult),
		});
		const result = (await call(generateCodesHandler, {
			params: { id: "d4" },
			body: { count: 3, prefix: "PREFIX", maximumUses: 1 },
			controller: ctrl,
		})) as BulkCodeResult;
		expect(result.generated).toBe(3);
		expect(result.codes).toHaveLength(3);
		expect(ctrl.generateBulkCodes).toHaveBeenCalledWith({
			discountId: "d4",
			count: 3,
			prefix: "PREFIX",
			maximumUses: 1,
		});
	});
});

// ── adminDiscountAnalytics ────────────────────────────────────────────────────

describe("admin GET /discounts/analytics", () => {
	it("returns analytics summary", async () => {
		const analytics: DiscountAnalytics = {
			totalDiscounts: 12,
			activeCount: 8,
			expiredCount: 2,
			scheduledCount: 2,
			totalUsage: 340,
			totalCodes: 55,
			typeDistribution: { percentage: 7, fixed_amount: 3, free_shipping: 2 },
			topByUsage: [],
		};
		const ctrl = makeController({
			getAnalytics: vi.fn().mockResolvedValue(analytics),
		});
		const result = (await call(analyticsHandler, {
			controller: ctrl,
		})) as { analytics: DiscountAnalytics };
		expect(result.analytics.totalDiscounts).toBe(12);
		expect(result.analytics.activeCount).toBe(8);
		expect(result.analytics.typeDistribution.percentage).toBe(7);
	});

	it("returns zero-state analytics when no discounts", async () => {
		const result = (await call(analyticsHandler)) as {
			analytics: DiscountAnalytics;
		};
		expect(result.analytics.totalDiscounts).toBe(0);
		expect(result.analytics.totalUsage).toBe(0);
	});
});

// ── adminListPriceRules ───────────────────────────────────────────────────────

describe("admin GET /discounts/price-rules", () => {
	it("returns empty list when no rules exist", async () => {
		const result = (await call(listPriceRulesHandler)) as {
			rules: CartPriceRule[];
			total: number;
			page: number;
		};
		expect(result.rules).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
	});

	it("paginates price rules", async () => {
		const rules = Array.from({ length: 7 }, () => makePriceRule());
		const ctrl = makeController({
			listPriceRules: vi.fn().mockResolvedValue({ rules, total: 7 }),
		});
		const result = (await call(listPriceRulesHandler, {
			query: { page: "1", limit: "5" },
			controller: ctrl,
		})) as { total: number; pages: number };
		expect(result.total).toBe(7);
		expect(result.pages).toBe(2);
		expect(ctrl.listPriceRules).toHaveBeenCalledWith({ limit: 5, offset: 0 });
	});

	it("filters by isActive=true", async () => {
		const ctrl = makeController();
		await call(listPriceRulesHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listPriceRules).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

// ── adminCreatePriceRule ──────────────────────────────────────────────────────

describe("admin POST /discounts/price-rules/create", () => {
	it("creates a price rule and returns it", async () => {
		const rule = makePriceRule({ name: "Big Spender" });
		const ctrl = makeController({
			createPriceRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(createPriceRuleHandler, {
			body: { name: "Big Spender", type: "percentage", value: 20 },
			controller: ctrl,
		})) as { rule: CartPriceRule };
		expect(result.rule.name).toBe("Big Spender");
		expect(ctrl.createPriceRule).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Big Spender", type: "percentage" }),
		);
	});

	it("creates a rule with conditions", async () => {
		const rule = makePriceRule();
		const ctrl = makeController({
			createPriceRule: vi.fn().mockResolvedValue(rule),
		});
		await call(createPriceRuleHandler, {
			body: {
				name: "Min Order",
				type: "percentage",
				value: 5,
				conditions: [{ type: "minimum_subtotal", value: 5000 }],
			},
			controller: ctrl,
		});
		expect(ctrl.createPriceRule).toHaveBeenCalledWith(
			expect.objectContaining({
				conditions: [{ type: "minimum_subtotal", value: 5000 }],
			}),
		);
	});
});

// ── adminGetPriceRule ─────────────────────────────────────────────────────────

describe("admin GET /discounts/price-rules/:id", () => {
	it("returns 404 when price rule not found", async () => {
		const result = (await call(getPriceRuleHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price rule not found");
	});

	it("returns price rule when found", async () => {
		const rule = makePriceRule({ id: "r1" });
		const ctrl = makeController({
			getPriceRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(getPriceRuleHandler, {
			params: { id: "r1" },
			controller: ctrl,
		})) as { rule: CartPriceRule };
		expect(result.rule.id).toBe("r1");
	});
});

// ── adminUpdatePriceRule ──────────────────────────────────────────────────────

describe("admin PUT /discounts/price-rules/:id/update", () => {
	it("returns 404 when price rule not found", async () => {
		const result = (await call(updatePriceRuleHandler, {
			params: { id: "missing" },
			body: { isActive: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated price rule on success", async () => {
		const rule = makePriceRule({ id: "r2", value: 25 });
		const ctrl = makeController({
			updatePriceRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(updatePriceRuleHandler, {
			params: { id: "r2" },
			body: { value: 25 },
			controller: ctrl,
		})) as { rule: CartPriceRule };
		expect(result.rule.value).toBe(25);
		expect(ctrl.updatePriceRule).toHaveBeenCalledWith(
			"r2",
			expect.objectContaining({ value: 25 }),
		);
	});
});

// ── adminDeletePriceRule ──────────────────────────────────────────────────────

describe("admin DELETE /discounts/price-rules/:id/delete", () => {
	it("returns 404 when price rule not found", async () => {
		const result = (await call(deletePriceRuleHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes price rule and returns success", async () => {
		const rule = makePriceRule({ id: "r3" });
		const ctrl = makeController({
			getPriceRule: vi.fn().mockResolvedValue(rule),
			deletePriceRule: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deletePriceRuleHandler, {
			params: { id: "r3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deletePriceRule).toHaveBeenCalledWith("r3");
	});
});
