import { describe, expect, it, vi } from "vitest";
import { adjustPoints } from "../admin/endpoints/adjust-points";
import { createRule } from "../admin/endpoints/create-rule";
import { deleteRule } from "../admin/endpoints/delete-rule";
import { getAccount } from "../admin/endpoints/get-account";
import { listAccounts } from "../admin/endpoints/list-accounts";
import { listRules } from "../admin/endpoints/list-rules";
import { listTiers } from "../admin/endpoints/list-tiers";
import { loyaltySummary } from "../admin/endpoints/loyalty-summary";
import {
	createTier,
	deleteTier,
	updateTier,
} from "../admin/endpoints/manage-tiers";
import { reactivateAccount } from "../admin/endpoints/reactivate-account";
import { suspendAccount } from "../admin/endpoints/suspend-account";
import { updateRule } from "../admin/endpoints/update-rule";
import type {
	AccountStatus,
	LoyaltyAccount,
	LoyaltyController,
	LoyaltyRule,
	LoyaltySummary,
	LoyaltyTier,
	LoyaltyTierSlug,
	LoyaltyTransaction,
	TransactionType,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAccount(overrides: Partial<LoyaltyAccount> = {}): LoyaltyAccount {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		balance: 500,
		lifetimeEarned: 1000,
		lifetimeRedeemed: 500,
		tier: "bronze" satisfies LoyaltyTierSlug,
		status: "active" satisfies AccountStatus,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTransaction(
	overrides: Partial<LoyaltyTransaction> = {},
): LoyaltyTransaction {
	return {
		id: crypto.randomUUID(),
		accountId: "acct_1",
		type: "earn" satisfies TransactionType,
		points: 100,
		description: "Order reward",
		createdAt: new Date(),
		...overrides,
	};
}

function makeRule(overrides: Partial<LoyaltyRule> = {}): LoyaltyRule {
	return {
		id: crypto.randomUUID(),
		name: "Per Dollar Rule",
		type: "per_dollar",
		points: 1,
		active: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeTier(overrides: Partial<LoyaltyTier> = {}): LoyaltyTier {
	return {
		id: crypto.randomUUID(),
		name: "Bronze",
		slug: "bronze",
		minPoints: 0,
		multiplier: 1,
		sortOrder: 1,
		...overrides,
	};
}

function makeController(
	overrides: Partial<LoyaltyController> = {},
): LoyaltyController {
	return {
		getOrCreateAccount: vi.fn().mockResolvedValue(makeAccount()),
		getAccount: vi.fn().mockResolvedValue(null),
		getAccountById: vi.fn().mockResolvedValue(null),
		suspendAccount: vi
			.fn()
			.mockResolvedValue(makeAccount({ status: "suspended" })),
		reactivateAccount: vi
			.fn()
			.mockResolvedValue(makeAccount({ status: "active" })),
		earnPoints: vi.fn().mockResolvedValue(makeTransaction({ type: "earn" })),
		redeemPoints: vi
			.fn()
			.mockResolvedValue(makeTransaction({ type: "redeem" })),
		adjustPoints: vi
			.fn()
			.mockResolvedValue(makeTransaction({ type: "adjust" })),
		listTransactions: vi.fn().mockResolvedValue([]),
		createRule: vi.fn().mockResolvedValue(makeRule()),
		updateRule: vi.fn().mockResolvedValue(null),
		deleteRule: vi.fn().mockResolvedValue(false),
		listRules: vi.fn().mockResolvedValue([]),
		calculateOrderPoints: vi.fn().mockResolvedValue(0),
		listTiers: vi.fn().mockResolvedValue([]),
		getTier: vi.fn().mockResolvedValue(null),
		createTier: vi.fn().mockResolvedValue(makeTier()),
		updateTier: vi.fn().mockResolvedValue(null),
		deleteTier: vi.fn().mockResolvedValue(false),
		listAccounts: vi.fn().mockResolvedValue([]),
		getSummary: vi.fn().mockResolvedValue({
			totalAccounts: 0,
			totalPointsOutstanding: 0,
			totalLifetimeEarned: 0,
			tierBreakdown: [],
		} satisfies LoyaltySummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: LoyaltyController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { loyalty: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listAccountsHandler = extractHandler(listAccounts);
const getAccountHandler = extractHandler(getAccount);
const adjustPointsHandler = extractHandler(adjustPoints);
const suspendAccountHandler = extractHandler(suspendAccount);
const reactivateAccountHandler = extractHandler(reactivateAccount);
const loyaltySummaryHandler = extractHandler(loyaltySummary);
const listRulesHandler = extractHandler(listRules);
const createRuleHandler = extractHandler(createRule);
const updateRuleHandler = extractHandler(updateRule);
const deleteRuleHandler = extractHandler(deleteRule);
const listTiersHandler = extractHandler(listTiers);
const createTierHandler = extractHandler(createTier);
const updateTierHandler = extractHandler(updateTier);
const deleteTierHandler = extractHandler(deleteTier);

// ── listAccounts ──────────────────────────────────────────────────────────────

describe("admin GET /loyalty/accounts", () => {
	it("returns empty list when no accounts", async () => {
		const result = (await call(listAccountsHandler)) as {
			accounts: LoyaltyAccount[];
			total: number;
		};
		expect(result.accounts).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns accounts from controller", async () => {
		const accounts = [makeAccount(), makeAccount()];
		const ctrl = makeController({
			listAccounts: vi.fn().mockResolvedValue(accounts),
		});
		const result = (await call(listAccountsHandler, { controller: ctrl })) as {
			accounts: LoyaltyAccount[];
			total: number;
		};
		expect(result.accounts).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards tier filter to controller", async () => {
		const ctrl = makeController();
		await call(listAccountsHandler, {
			query: { tier: "gold" },
			controller: ctrl,
		});
		expect(ctrl.listAccounts).toHaveBeenCalledWith(
			expect.objectContaining({ tier: "gold" }),
		);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listAccountsHandler, {
			query: { status: "suspended" },
			controller: ctrl,
		});
		expect(ctrl.listAccounts).toHaveBeenCalledWith(
			expect.objectContaining({ status: "suspended" }),
		);
	});
});

// ── getAccount ────────────────────────────────────────────────────────────────

describe("admin GET /loyalty/accounts/:customerId", () => {
	it("returns error when account not found", async () => {
		const result = (await call(getAccountHandler, {
			params: { customerId: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("returns account with transactions when found", async () => {
		const account = makeAccount({ customerId: "cust_1" });
		const transactions = [makeTransaction({ accountId: account.id })];
		const ctrl = makeController({
			getAccount: vi.fn().mockResolvedValue(account),
			listTransactions: vi.fn().mockResolvedValue(transactions),
		});
		const result = (await call(getAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: LoyaltyAccount; transactions: LoyaltyTransaction[] };
		expect(result.account.customerId).toBe("cust_1");
		expect(result.transactions).toHaveLength(1);
	});
});

// ── adjustPoints ──────────────────────────────────────────────────────────────

describe("admin POST /loyalty/accounts/:customerId/adjust", () => {
	it("adjusts points and returns transaction and account", async () => {
		const account = makeAccount({ customerId: "cust_1", balance: 600 });
		const transaction = makeTransaction({ type: "adjust", points: 100 });
		const ctrl = makeController({
			adjustPoints: vi.fn().mockResolvedValue(transaction),
			getAccount: vi.fn().mockResolvedValue(account),
		});
		const result = (await call(adjustPointsHandler, {
			params: { customerId: "cust_1" },
			body: { points: 100, description: "Manual adjustment" },
			controller: ctrl,
		})) as { transaction: LoyaltyTransaction; account: LoyaltyAccount };
		expect(result.transaction.type).toBe("adjust");
		expect(result.transaction.points).toBe(100);
		expect(result.account.customerId).toBe("cust_1");
	});

	it("calls controller with correct customerId and body params", async () => {
		const ctrl = makeController({
			getAccount: vi.fn().mockResolvedValue(makeAccount()),
		});
		await call(adjustPointsHandler, {
			params: { customerId: "cust_2" },
			body: { points: -50, description: "Correction" },
			controller: ctrl,
		});
		expect(ctrl.adjustPoints).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust_2", points: -50 }),
		);
	});
});

// ── suspendAccount ────────────────────────────────────────────────────────────

describe("admin POST /loyalty/accounts/:customerId/suspend", () => {
	it("suspends account and returns it", async () => {
		const account = makeAccount({ status: "suspended" });
		const ctrl = makeController({
			suspendAccount: vi.fn().mockResolvedValue(account),
		});
		const result = (await call(suspendAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: LoyaltyAccount };
		expect(result.account.status).toBe("suspended");
		expect(ctrl.suspendAccount).toHaveBeenCalledWith("cust_1");
	});
});

// ── reactivateAccount ─────────────────────────────────────────────────────────

describe("admin POST /loyalty/accounts/:customerId/reactivate", () => {
	it("reactivates account and returns it", async () => {
		const account = makeAccount({ status: "active" });
		const ctrl = makeController({
			reactivateAccount: vi.fn().mockResolvedValue(account),
		});
		const result = (await call(reactivateAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: LoyaltyAccount };
		expect(result.account.status).toBe("active");
		expect(ctrl.reactivateAccount).toHaveBeenCalledWith("cust_1");
	});
});

// ── loyaltySummary ────────────────────────────────────────────────────────────

describe("admin GET /loyalty/summary", () => {
	it("returns zero-state summary when no data", async () => {
		const result = (await call(loyaltySummaryHandler)) as LoyaltySummary;
		expect(result.totalAccounts).toBe(0);
		expect(result.totalPointsOutstanding).toBe(0);
		expect(result.totalLifetimeEarned).toBe(0);
		expect(result.tierBreakdown).toHaveLength(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalAccounts: 120,
				totalPointsOutstanding: 48000,
				totalLifetimeEarned: 95000,
				tierBreakdown: [
					{ tier: "bronze" as LoyaltyTierSlug, count: 80 },
					{ tier: "silver" as LoyaltyTierSlug, count: 30 },
					{ tier: "gold" as LoyaltyTierSlug, count: 8 },
					{ tier: "platinum" as LoyaltyTierSlug, count: 2 },
				],
			}),
		});
		const result = (await call(loyaltySummaryHandler, {
			controller: ctrl,
		})) as LoyaltySummary;
		expect(result.totalAccounts).toBe(120);
		expect(result.totalLifetimeEarned).toBe(95000);
		expect(result.tierBreakdown).toHaveLength(4);
	});
});

// ── listRules ─────────────────────────────────────────────────────────────────

describe("admin GET /loyalty/rules", () => {
	it("returns empty list when no rules", async () => {
		const result = (await call(listRulesHandler)) as { rules: LoyaltyRule[] };
		expect(result.rules).toHaveLength(0);
	});

	it("returns rules from controller", async () => {
		const rules = [makeRule(), makeRule()];
		const ctrl = makeController({
			listRules: vi.fn().mockResolvedValue(rules),
		});
		const result = (await call(listRulesHandler, { controller: ctrl })) as {
			rules: LoyaltyRule[];
		};
		expect(result.rules).toHaveLength(2);
	});

	it("forwards activeOnly filter to controller", async () => {
		const ctrl = makeController();
		await call(listRulesHandler, {
			query: { activeOnly: "true" },
			controller: ctrl,
		});
		expect(ctrl.listRules).toHaveBeenCalledWith(true);
	});
});

// ── createRule ────────────────────────────────────────────────────────────────

describe("admin POST /loyalty/rules/create", () => {
	it("creates rule and returns it", async () => {
		const rule = makeRule({
			name: "Signup Bonus",
			type: "signup",
			points: 200,
		});
		const ctrl = makeController({
			createRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(createRuleHandler, {
			body: { name: "Signup Bonus", type: "signup", points: 200 },
			controller: ctrl,
		})) as { rule: LoyaltyRule };
		expect(result.rule.name).toBe("Signup Bonus");
		expect(result.rule.type).toBe("signup");
		expect(result.rule.points).toBe(200);
	});

	it("passes minOrderAmount when provided", async () => {
		const ctrl = makeController();
		await call(createRuleHandler, {
			body: {
				name: "Order Rule",
				type: "per_dollar",
				points: 1,
				minOrderAmount: 5000,
			},
			controller: ctrl,
		});
		expect(ctrl.createRule).toHaveBeenCalledWith(
			expect.objectContaining({ minOrderAmount: 5000 }),
		);
	});
});

// ── updateRule ────────────────────────────────────────────────────────────────

describe("admin PUT /loyalty/rules/:id/update", () => {
	it("returns error when rule not found", async () => {
		const result = (await call(updateRuleHandler, {
			params: { id: "missing" },
			body: { active: false },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates rule and returns it", async () => {
		const rule = makeRule({ points: 2, active: false });
		const ctrl = makeController({
			updateRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(updateRuleHandler, {
			params: { id: rule.id },
			body: { points: 2, active: false },
			controller: ctrl,
		})) as { rule: LoyaltyRule };
		expect(result.rule.points).toBe(2);
		expect(result.rule.active).toBe(false);
	});
});

// ── deleteRule ────────────────────────────────────────────────────────────────

describe("admin DELETE /loyalty/rules/:id/delete", () => {
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

// ── listTiers ─────────────────────────────────────────────────────────────────

describe("admin GET /loyalty/tiers", () => {
	it("returns empty list when no tiers", async () => {
		const result = (await call(listTiersHandler)) as { tiers: LoyaltyTier[] };
		expect(result.tiers).toHaveLength(0);
	});

	it("returns tiers from controller", async () => {
		const tiers = [makeTier({ slug: "bronze" }), makeTier({ slug: "silver" })];
		const ctrl = makeController({
			listTiers: vi.fn().mockResolvedValue(tiers),
		});
		const result = (await call(listTiersHandler, { controller: ctrl })) as {
			tiers: LoyaltyTier[];
		};
		expect(result.tiers).toHaveLength(2);
	});
});

// ── createTier ────────────────────────────────────────────────────────────────

describe("admin POST /loyalty/tiers/create", () => {
	it("creates tier and returns it", async () => {
		const tier = makeTier({ name: "Gold", slug: "gold", minPoints: 2000 });
		const ctrl = makeController({
			createTier: vi.fn().mockResolvedValue(tier),
		});
		const result = (await call(createTierHandler, {
			body: { name: "Gold", slug: "gold", minPoints: 2000 },
			controller: ctrl,
		})) as { tier: LoyaltyTier };
		expect(result.tier.slug).toBe("gold");
		expect(result.tier.minPoints).toBe(2000);
	});

	it("passes multiplier and perks when provided", async () => {
		const ctrl = makeController();
		await call(createTierHandler, {
			body: {
				name: "Platinum",
				slug: "platinum",
				minPoints: 5000,
				multiplier: 3,
				perks: { freeShipping: true },
			},
			controller: ctrl,
		});
		expect(ctrl.createTier).toHaveBeenCalledWith(
			expect.objectContaining({ multiplier: 3 }),
		);
	});
});

// ── updateTier ────────────────────────────────────────────────────────────────

describe("admin PUT /loyalty/tiers/:id/update", () => {
	it("returns error when tier not found", async () => {
		const result = (await call(updateTierHandler, {
			params: { id: "missing" },
			body: { minPoints: 500 },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates tier and returns it", async () => {
		const tier = makeTier({ minPoints: 500, multiplier: 1.5 });
		const ctrl = makeController({
			updateTier: vi.fn().mockResolvedValue(tier),
		});
		const result = (await call(updateTierHandler, {
			params: { id: tier.id },
			body: { minPoints: 500, multiplier: 1.5 },
			controller: ctrl,
		})) as { tier: LoyaltyTier };
		expect(result.tier.minPoints).toBe(500);
		expect(result.tier.multiplier).toBe(1.5);
	});
});

// ── deleteTier ────────────────────────────────────────────────────────────────

describe("admin DELETE /loyalty/tiers/:id/delete", () => {
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
