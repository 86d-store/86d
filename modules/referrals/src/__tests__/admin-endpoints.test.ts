import { describe, expect, it, vi } from "vitest";
import { completeReferralEndpoint } from "../admin/endpoints/complete-referral";
import { createRewardRuleEndpoint } from "../admin/endpoints/create-reward-rule";
import { deactivateCodeEndpoint } from "../admin/endpoints/deactivate-code";
import { deleteRewardRuleEndpoint } from "../admin/endpoints/delete-reward-rule";
import { getCodeEndpoint } from "../admin/endpoints/get-code";
import { getReferralEndpoint } from "../admin/endpoints/get-referral";
import { listCodesEndpoint } from "../admin/endpoints/list-codes";
import { listReferralsEndpoint } from "../admin/endpoints/list-referrals";
import { listRewardRulesEndpoint } from "../admin/endpoints/list-reward-rules";
import { revokeReferralEndpoint } from "../admin/endpoints/revoke-referral";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateRewardRuleEndpoint } from "../admin/endpoints/update-reward-rule";
import type {
	Referral,
	ReferralCode,
	ReferralController,
	ReferralRewardRule,
	ReferralStats,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCode(overrides: Partial<ReferralCode> = {}): ReferralCode {
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		code: "REF-ABC123",
		active: true,
		usageCount: 0,
		maxUses: 10,
		createdAt: new Date(),
		...overrides,
	};
}

function makeReferral(overrides: Partial<Referral> = {}): Referral {
	return {
		id: crypto.randomUUID(),
		referrerCodeId: "code_1",
		referrerCustomerId: "cust_1",
		refereeCustomerId: "cust_2",
		refereeEmail: "referee@example.com",
		status: "pending",
		referrerRewarded: false,
		refereeRewarded: false,
		createdAt: new Date(),
		...overrides,
	};
}

function makeRule(
	overrides: Partial<ReferralRewardRule> = {},
): ReferralRewardRule {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Standard Referral",
		referrerRewardType: "store_credit",
		referrerRewardValue: 1000,
		refereeRewardType: "percentage_discount",
		refereeRewardValue: 10,
		minOrderAmount: 0,
		active: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<ReferralController> = {},
): ReferralController {
	return {
		createCode: vi.fn().mockResolvedValue(makeCode()),
		getCode: vi.fn().mockResolvedValue(null),
		getCodeByCode: vi.fn().mockResolvedValue(null),
		getCodeForCustomer: vi.fn().mockResolvedValue(null),
		listCodes: vi.fn().mockResolvedValue([]),
		deactivateCode: vi.fn().mockResolvedValue(null),
		createReferral: vi.fn().mockResolvedValue(null),
		getReferral: vi.fn().mockResolvedValue(null),
		listReferrals: vi.fn().mockResolvedValue([]),
		completeReferral: vi.fn().mockResolvedValue(null),
		revokeReferral: vi.fn().mockResolvedValue(null),
		markReferrerRewarded: vi.fn().mockResolvedValue(null),
		markRefereeRewarded: vi.fn().mockResolvedValue(null),
		createRewardRule: vi.fn().mockResolvedValue(makeRule()),
		getRewardRule: vi.fn().mockResolvedValue(null),
		listRewardRules: vi.fn().mockResolvedValue([]),
		updateRewardRule: vi.fn().mockResolvedValue(null),
		deleteRewardRule: vi.fn().mockResolvedValue(false),
		getStats: vi.fn().mockResolvedValue({
			totalCodes: 0,
			totalReferrals: 0,
			completedReferrals: 0,
			pendingReferrals: 0,
			conversionRate: 0,
		} satisfies ReferralStats),
		getStatsForCustomer: vi.fn().mockResolvedValue({
			code: null,
			totalReferrals: 0,
			completedReferrals: 0,
			pendingReferrals: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ReferralController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { referrals: opts.controller ?? makeController() },
		},
	});
}

const listReferralsHandler = extractHandler(listReferralsEndpoint);
const getReferralHandler = extractHandler(getReferralEndpoint);
const completeHandler = extractHandler(completeReferralEndpoint);
const revokeHandler = extractHandler(revokeReferralEndpoint);
const listCodesHandler = extractHandler(listCodesEndpoint);
const getCodeHandler = extractHandler(getCodeEndpoint);
const deactivateCodeHandler = extractHandler(deactivateCodeEndpoint);
const listRulesHandler = extractHandler(listRewardRulesEndpoint);
const createRuleHandler = extractHandler(createRewardRuleEndpoint);
const updateRuleHandler = extractHandler(updateRewardRuleEndpoint);
const deleteRuleHandler = extractHandler(deleteRewardRuleEndpoint);
const statsHandler = extractHandler(statsEndpoint);

describe("admin GET /referrals", () => {
	it("returns empty list", async () => {
		const result = (await call(listReferralsHandler)) as {
			referrals: Referral[];
			total: number;
		};
		expect(result.referrals).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listReferralsHandler, {
			query: { status: "completed" },
			controller: ctrl,
		});
		expect(ctrl.listReferrals).toHaveBeenCalledWith(
			expect.objectContaining({ status: "completed" }),
		);
	});
});

describe("admin GET /referrals/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getReferralHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("returns referral when found", async () => {
		const referral = makeReferral({ id: "ref_1" });
		const ctrl = makeController({
			getReferral: vi.fn().mockResolvedValue(referral),
		});
		const result = (await call(getReferralHandler, {
			params: { id: "ref_1" },
			controller: ctrl,
		})) as { referral: Referral };
		expect(result.referral.id).toBe("ref_1");
	});
});

describe("admin POST /referrals/:id/complete", () => {
	it("returns error when cannot complete", async () => {
		const result = (await call(completeHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("completes referral", async () => {
		const referral = makeReferral({ status: "completed" });
		const ctrl = makeController({
			completeReferral: vi.fn().mockResolvedValue(referral),
			listRewardRules: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(completeHandler, {
			params: { id: referral.id },
			controller: ctrl,
		})) as { referral: Referral };
		expect(result.referral.status).toBe("completed");
	});
});

describe("admin POST /referrals/:id/revoke", () => {
	it("returns error when cannot revoke", async () => {
		const result = (await call(revokeHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("revokes referral", async () => {
		const referral = makeReferral({ status: "revoked" });
		const ctrl = makeController({
			revokeReferral: vi.fn().mockResolvedValue(referral),
		});
		const result = (await call(revokeHandler, {
			params: { id: referral.id },
			controller: ctrl,
		})) as { referral: Referral };
		expect(result.referral.status).toBe("revoked");
	});
});

describe("admin GET /referrals/codes", () => {
	it("returns empty list", async () => {
		const result = (await call(listCodesHandler)) as {
			codes: ReferralCode[];
			total: number;
		};
		expect(result.codes).toHaveLength(0);
	});

	it("forwards active filter", async () => {
		const ctrl = makeController();
		await call(listCodesHandler, {
			query: { active: "true" },
			controller: ctrl,
		});
		expect(ctrl.listCodes).toHaveBeenCalledWith(
			expect.objectContaining({ active: true }),
		);
	});
});

describe("admin GET /referrals/codes/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getCodeHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("returns code when found", async () => {
		const code = makeCode({ id: "code_1" });
		const ctrl = makeController({
			getCode: vi.fn().mockResolvedValue(code),
		});
		const result = (await call(getCodeHandler, {
			params: { id: "code_1" },
			controller: ctrl,
		})) as { code: ReferralCode };
		expect(result.code.id).toBe("code_1");
	});
});

describe("admin POST /referrals/codes/:id/deactivate", () => {
	it("returns error when not found", async () => {
		const result = (await call(deactivateCodeHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("deactivates code", async () => {
		const code = makeCode({ active: false });
		const ctrl = makeController({
			deactivateCode: vi.fn().mockResolvedValue(code),
		});
		const result = (await call(deactivateCodeHandler, {
			params: { id: code.id },
			controller: ctrl,
		})) as { code: ReferralCode };
		expect(result.code.active).toBe(false);
	});
});

describe("admin GET /referrals/rules", () => {
	it("returns empty list", async () => {
		const result = (await call(listRulesHandler)) as {
			rules: ReferralRewardRule[];
		};
		expect(result.rules).toHaveLength(0);
	});

	it("returns active rules", async () => {
		const rule = makeRule({ active: true });
		const ctrl = makeController({
			listRewardRules: vi.fn().mockResolvedValue([rule]),
		});
		const result = (await call(listRulesHandler, {
			query: { active: "true" },
			controller: ctrl,
		})) as { rules: ReferralRewardRule[] };
		expect(result.rules).toHaveLength(1);
	});
});

describe("admin POST /referrals/rules/create", () => {
	it("creates reward rule", async () => {
		const rule = makeRule({ name: "Summer Promo" });
		const ctrl = makeController({
			createRewardRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(createRuleHandler, {
			body: {
				name: "Summer Promo",
				referrerRewardType: "store_credit",
				referrerRewardValue: 1500,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 15,
			},
			controller: ctrl,
		})) as { rule: ReferralRewardRule };
		expect(result.rule.name).toBe("Summer Promo");
	});
});

describe("admin POST /referrals/rules/:id/update", () => {
	it("returns error when not found", async () => {
		const result = (await call(updateRuleHandler, {
			params: { id: "missing" },
			body: { active: false },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates reward rule", async () => {
		const rule = makeRule({ active: false });
		const ctrl = makeController({
			updateRewardRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(updateRuleHandler, {
			params: { id: rule.id },
			body: { active: false },
			controller: ctrl,
		})) as { rule: ReferralRewardRule };
		expect(result.rule.active).toBe(false);
	});
});

describe("admin POST /referrals/rules/:id/delete", () => {
	it("deletes rule and returns success=false when not found", async () => {
		const result = (await call(deleteRuleHandler, {
			params: { id: "missing" },
		})) as { success: boolean };
		expect(result.success).toBe(false);
	});

	it("deletes rule and returns success=true", async () => {
		const ctrl = makeController({
			deleteRewardRule: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRuleHandler, {
			params: { id: "rule_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /referrals/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as { stats: ReferralStats };
		expect(result.stats.totalReferrals).toBe(0);
		expect(result.stats.conversionRate).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalCodes: 50,
				totalReferrals: 120,
				completedReferrals: 85,
				pendingReferrals: 35,
				conversionRate: 0.71,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: ReferralStats;
		};
		expect(result.stats.totalReferrals).toBe(120);
		expect(result.stats.conversionRate).toBe(0.71);
	});
});
