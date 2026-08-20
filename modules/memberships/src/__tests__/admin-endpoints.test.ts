import { describe, expect, it, vi } from "vitest";
import { addBenefit } from "../admin/endpoints/add-benefit";
import { cancelMembership } from "../admin/endpoints/cancel-membership";
import { createPlan } from "../admin/endpoints/create-plan";
import { deletePlan } from "../admin/endpoints/delete-plan";
import { gateProduct } from "../admin/endpoints/gate-product";
import { getMembership } from "../admin/endpoints/get-membership";
import { getStats } from "../admin/endpoints/get-stats";
import { listMemberships } from "../admin/endpoints/list-memberships";
import { listPlans } from "../admin/endpoints/list-plans";
import { pauseMembership } from "../admin/endpoints/pause-membership";
import { removeBenefit } from "../admin/endpoints/remove-benefit";
import { resumeMembership } from "../admin/endpoints/resume-membership";
import { ungateProduct } from "../admin/endpoints/ungate-product";
import { updatePlan } from "../admin/endpoints/update-plan";
import type {
	BillingInterval,
	Membership,
	MembershipBenefit,
	MembershipController,
	MembershipPlan,
	MembershipProduct,
	MembershipStats,
	MembershipStatus,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePlan(overrides: Partial<MembershipPlan> = {}): MembershipPlan {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Gold Plan",
		slug: "gold",
		price: 1999,
		billingInterval: "monthly" as BillingInterval,
		trialDays: 7,
		isActive: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMembership(overrides: Partial<Membership> = {}): Membership {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		planId: "plan_1",
		status: "active" as MembershipStatus,
		startDate: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBenefit(
	overrides: Partial<MembershipBenefit> = {},
): MembershipBenefit {
	return {
		id: crypto.randomUUID(),
		planId: "plan_1",
		type: "discount_percentage",
		value: "10",
		isActive: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeGatedProduct(
	overrides: Partial<MembershipProduct> = {},
): MembershipProduct {
	return {
		id: crypto.randomUUID(),
		planId: "plan_1",
		productId: "prod_1",
		assignedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<MembershipController> = {},
): MembershipController {
	return {
		createPlan: vi.fn().mockResolvedValue(makePlan()),
		getPlan: vi.fn().mockResolvedValue(null),
		getPlanBySlug: vi.fn().mockResolvedValue(null),
		updatePlan: vi.fn().mockResolvedValue(null),
		deletePlan: vi.fn().mockResolvedValue(false),
		listPlans: vi.fn().mockResolvedValue([]),
		countPlans: vi.fn().mockResolvedValue(0),
		subscribe: vi.fn().mockResolvedValue(makeMembership()),
		cancelMembership: vi.fn().mockResolvedValue(null),
		pauseMembership: vi.fn().mockResolvedValue(null),
		resumeMembership: vi.fn().mockResolvedValue(null),
		getMembership: vi.fn().mockResolvedValue(null),
		getCustomerMembership: vi.fn().mockResolvedValue(null),
		listMemberships: vi.fn().mockResolvedValue([]),
		countMemberships: vi.fn().mockResolvedValue(0),
		addBenefit: vi.fn().mockResolvedValue(makeBenefit()),
		removeBenefit: vi.fn().mockResolvedValue(false),
		listBenefits: vi.fn().mockResolvedValue([]),
		getCustomerBenefits: vi.fn().mockResolvedValue([]),
		gateProduct: vi.fn().mockResolvedValue(makeGatedProduct()),
		ungateProduct: vi.fn().mockResolvedValue(false),
		listGatedProducts: vi.fn().mockResolvedValue([]),
		countGatedProducts: vi.fn().mockResolvedValue(0),
		canAccessProduct: vi.fn().mockResolvedValue(false),
		getStats: vi.fn().mockResolvedValue({
			totalPlans: 0,
			activePlans: 0,
			totalMembers: 0,
			activeMembers: 0,
			trialMembers: 0,
			cancelledMembers: 0,
			gatedProducts: 0,
		} satisfies MembershipStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: MembershipController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { memberships: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listMembershipsHandler = extractHandler(listMemberships);
const getStatsHandler = extractHandler(getStats);
const listPlansHandler = extractHandler(listPlans);
const createPlanHandler = extractHandler(createPlan);
const updatePlanHandler = extractHandler(updatePlan);
const deletePlanHandler = extractHandler(deletePlan);
const addBenefitHandler = extractHandler(addBenefit);
const removeBenefitHandler = extractHandler(removeBenefit);
const gateProductHandler = extractHandler(gateProduct);
const ungateProductHandler = extractHandler(ungateProduct);
const getMembershipHandler = extractHandler(getMembership);
const cancelMembershipHandler = extractHandler(cancelMembership);
const pauseMembershipHandler = extractHandler(pauseMembership);
const resumeMembershipHandler = extractHandler(resumeMembership);

// ── listMemberships ───────────────────────────────────────────────────────────

describe("admin GET /memberships", () => {
	it("returns empty list and zero total", async () => {
		const result = (await call(listMembershipsHandler)) as {
			memberships: Membership[];
			total: number;
		};
		expect(result.memberships).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns memberships from controller", async () => {
		const memberships = [makeMembership(), makeMembership()];
		const ctrl = makeController({
			listMemberships: vi.fn().mockResolvedValue(memberships),
			countMemberships: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listMembershipsHandler, {
			controller: ctrl,
		})) as { memberships: Membership[]; total: number };
		expect(result.memberships).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listMembershipsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listMemberships).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe("admin GET /memberships/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as { stats: MembershipStats };
		expect(result.stats.totalPlans).toBe(0);
		expect(result.stats.activeMembers).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalPlans: 3,
				activePlans: 2,
				totalMembers: 120,
				activeMembers: 95,
				trialMembers: 10,
				cancelledMembers: 15,
				gatedProducts: 8,
			}),
		});
		const result = (await call(getStatsHandler, { controller: ctrl })) as {
			stats: MembershipStats;
		};
		expect(result.stats.totalPlans).toBe(3);
		expect(result.stats.totalMembers).toBe(120);
		expect(result.stats.gatedProducts).toBe(8);
	});
});

// ── listPlans ─────────────────────────────────────────────────────────────────

describe("admin GET /memberships/plans", () => {
	it("returns empty list and zero total", async () => {
		const result = (await call(listPlansHandler)) as {
			plans: MembershipPlan[];
			total: number;
		};
		expect(result.plans).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns plans from controller", async () => {
		const plans = [makePlan(), makePlan()];
		const ctrl = makeController({
			listPlans: vi.fn().mockResolvedValue(plans),
			countPlans: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listPlansHandler, { controller: ctrl })) as {
			plans: MembershipPlan[];
			total: number;
		};
		expect(result.plans).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── createPlan ────────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/create", () => {
	it("creates a plan and returns it", async () => {
		const plan = makePlan({ name: "Silver Plan", slug: "silver" });
		const ctrl = makeController({
			createPlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(createPlanHandler, {
			body: {
				name: "Silver Plan",
				slug: "silver",
				price: 999,
				billingInterval: "monthly",
			},
			controller: ctrl,
		})) as { plan: MembershipPlan };
		expect(result.plan.name).toBe("Silver Plan");
		expect(result.plan.slug).toBe("silver");
	});

	it("returns 400 when slug already exists", async () => {
		const ctrl = makeController({
			getPlanBySlug: vi.fn().mockResolvedValue(makePlan({ slug: "gold" })),
		});
		const result = (await call(createPlanHandler, {
			body: {
				name: "Gold Plan",
				slug: "gold",
				price: 1999,
				billingInterval: "monthly",
			},
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.error).toBe("A plan with this slug already exists");
		expect(result.status).toBe(400);
	});
});

// ── updatePlan ────────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/:id/update", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(updatePlanHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Plan not found");
		expect(result.status).toBe(404);
	});

	it("updates plan and returns it", async () => {
		const plan = makePlan({ name: "Updated Plan" });
		const ctrl = makeController({
			updatePlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(updatePlanHandler, {
			params: { id: plan.id },
			body: { name: "Updated Plan" },
			controller: ctrl,
		})) as { plan: MembershipPlan };
		expect(result.plan.name).toBe("Updated Plan");
	});
});

// ── deletePlan ────────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/:id/delete", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(deletePlanHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Plan not found");
		expect(result.status).toBe(404);
	});

	it("deletes plan and returns success", async () => {
		const ctrl = makeController({
			deletePlan: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePlanHandler, {
			params: { id: "plan_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── addBenefit ────────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/:planId/benefits/add", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(addBenefitHandler, {
			params: { planId: "missing" },
			body: { type: "free_shipping", value: "true" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Plan not found");
		expect(result.status).toBe(404);
	});

	it("adds benefit to plan and returns it", async () => {
		const benefit = makeBenefit({
			planId: "plan_1",
			type: "free_shipping",
			value: "true",
		});
		const ctrl = makeController({
			getPlan: vi.fn().mockResolvedValue(makePlan({ id: "plan_1" })),
			addBenefit: vi.fn().mockResolvedValue(benefit),
		});
		const result = (await call(addBenefitHandler, {
			params: { planId: "plan_1" },
			body: { type: "free_shipping", value: "true" },
			controller: ctrl,
		})) as { benefit: MembershipBenefit };
		expect(result.benefit.type).toBe("free_shipping");
		expect(result.benefit.planId).toBe("plan_1");
	});
});

// ── removeBenefit ─────────────────────────────────────────────────────────────

describe("admin POST /memberships/benefits/:id/remove", () => {
	it("returns 404 when benefit not found", async () => {
		const result = (await call(removeBenefitHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Benefit not found");
		expect(result.status).toBe(404);
	});

	it("removes benefit and returns success", async () => {
		const ctrl = makeController({
			removeBenefit: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeBenefitHandler, {
			params: { id: "benefit_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── gateProduct ───────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/:planId/gate", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(gateProductHandler, {
			params: { planId: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.error).toBe("Plan not found");
		expect(result.status).toBe(404);
	});

	it("gates product and returns gated count", async () => {
		const ctrl = makeController({
			getPlan: vi.fn().mockResolvedValue(makePlan({ id: "plan_1" })),
			gateProduct: vi.fn().mockResolvedValue(makeGatedProduct()),
		});
		const result = (await call(gateProductHandler, {
			params: { planId: "plan_1" },
			body: { productIds: ["prod_2"] },
			controller: ctrl,
		})) as { gated: number };
		expect(result.gated).toBe(1);
		expect(ctrl.gateProduct).toHaveBeenCalledWith(
			expect.objectContaining({ planId: "plan_1", productId: "prod_2" }),
		);
	});
});

// ── ungateProduct ─────────────────────────────────────────────────────────────

describe("admin POST /memberships/plans/:planId/ungate", () => {
	it("ungates product and returns count", async () => {
		const ctrl = makeController({
			ungateProduct: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(ungateProductHandler, {
			params: { planId: "plan_1" },
			body: { productIds: ["prod_1"] },
			controller: ctrl,
		})) as { ungated: number };
		expect(result.ungated).toBe(1);
	});
});

// ── getMembership ─────────────────────────────────────────────────────────────

describe("admin GET /memberships/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getMembershipHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Membership not found");
		expect(result.status).toBe(404);
	});

	it("returns membership and plan when found", async () => {
		const membership = makeMembership({ id: "mem_1", planId: "plan_1" });
		const plan = makePlan({ id: "plan_1" });
		const ctrl = makeController({
			getMembership: vi.fn().mockResolvedValue(membership),
			getPlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(getMembershipHandler, {
			params: { id: "mem_1" },
			controller: ctrl,
		})) as { membership: Membership; plan: MembershipPlan };
		expect(result.membership.id).toBe("mem_1");
		expect(result.plan.id).toBe("plan_1");
	});
});

// ── cancelMembership ──────────────────────────────────────────────────────────

describe("admin POST /memberships/:id/cancel", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(cancelMembershipHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Membership not found");
		expect(result.status).toBe(404);
	});

	it("cancels membership and returns it", async () => {
		const membership = makeMembership({ status: "cancelled" });
		const ctrl = makeController({
			cancelMembership: vi.fn().mockResolvedValue(membership),
		});
		const result = (await call(cancelMembershipHandler, {
			params: { id: membership.id },
			controller: ctrl,
		})) as { membership: Membership };
		expect(result.membership.status).toBe("cancelled");
		expect(ctrl.cancelMembership).toHaveBeenCalledWith(membership.id);
	});
});

// ── pauseMembership ───────────────────────────────────────────────────────────

describe("admin POST /memberships/:id/pause", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(pauseMembershipHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Membership not found");
		expect(result.status).toBe(404);
	});

	it("pauses membership and returns it", async () => {
		const membership = makeMembership({ status: "paused" });
		const ctrl = makeController({
			pauseMembership: vi.fn().mockResolvedValue(membership),
		});
		const result = (await call(pauseMembershipHandler, {
			params: { id: membership.id },
			controller: ctrl,
		})) as { membership: Membership };
		expect(result.membership.status).toBe("paused");
		expect(ctrl.pauseMembership).toHaveBeenCalledWith(membership.id);
	});
});

// ── resumeMembership ──────────────────────────────────────────────────────────

describe("admin POST /memberships/:id/resume", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(resumeMembershipHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Membership not found");
		expect(result.status).toBe(404);
	});

	it("resumes membership and returns it", async () => {
		const membership = makeMembership({ status: "active" });
		const ctrl = makeController({
			resumeMembership: vi.fn().mockResolvedValue(membership),
		});
		const result = (await call(resumeMembershipHandler, {
			params: { id: membership.id },
			controller: ctrl,
		})) as { membership: Membership };
		expect(result.membership.status).toBe("active");
		expect(ctrl.resumeMembership).toHaveBeenCalledWith(membership.id);
	});
});
