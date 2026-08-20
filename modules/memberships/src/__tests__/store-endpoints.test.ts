import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { MembershipPlan } from "../service";
import { createMembershipController } from "../service-impl";

/**
 * Store endpoint integration tests for the memberships module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-plans: active plans only, sorted by sortOrder
 * 2. get-plan: slug lookup, active only
 * 3. subscribe: auth required, subscribes customer to a plan
 * 4. get-my-membership: auth required, returns current membership
 * 5. cancel-membership: auth required, cancels active membership
 * 6. can-access-product: auth required, checks product gating
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

async function createTestPlan(
	ctrl: ReturnType<typeof createMembershipController>,
	overrides: Partial<Parameters<typeof ctrl.createPlan>[0]> & { name: string },
) {
	const slug =
		overrides.slug ??
		overrides.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	return ctrl.createPlan({
		price: 999,
		billingInterval: "monthly",
		slug,
		...overrides,
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListPlans(
	data: DataService,
	query: { take?: number } = {},
) {
	const controller = createMembershipController(data);
	const plans = await controller.listPlans({
		isActive: true,
		take: query.take ?? 50,
	});
	return { plans };
}

async function simulateGetPlan(data: DataService, slug: string) {
	const controller = createMembershipController(data);
	const plan = await controller.getPlanBySlug(slug);
	if (!plan?.isActive) {
		return { error: "Plan not found", status: 404 };
	}
	return { plan };
}

async function simulateSubscribe(
	data: DataService,
	body: { planId: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createMembershipController(data);
	const plan = await controller.getPlan(body.planId);
	if (!plan?.isActive) {
		return { error: "Plan not found", status: 404 };
	}
	const membership = await controller.subscribe({
		customerId: opts.customerId,
		planId: body.planId,
	});
	return { membership };
}

async function simulateGetMyMembership(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createMembershipController(data);
	const membership = await controller.getCustomerMembership(opts.customerId);
	return { membership };
}

async function simulateCancelMembership(
	data: DataService,
	membershipId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createMembershipController(data);
	const membership = await controller.getMembership(membershipId);
	if (!membership || membership.customerId !== opts.customerId) {
		return { error: "Membership not found", status: 404 };
	}
	const cancelled = await controller.cancelMembership(membershipId);
	if (!cancelled) {
		return { error: "Membership not found", status: 404 };
	}
	return { membership: cancelled };
}

async function simulateCanAccessProduct(
	data: DataService,
	productId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { canAccess: false };
	}
	const controller = createMembershipController(data);
	const canAccess = await controller.canAccessProduct({
		customerId: opts.customerId,
		productId,
	});
	return { canAccess };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list plans — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active plans", async () => {
		const ctrl = createMembershipController(data);
		await createTestPlan(ctrl, { name: "Basic", isActive: true });
		await createTestPlan(ctrl, { name: "Hidden", isActive: false });

		const result = await simulateListPlans(data);

		expect(result.plans).toHaveLength(1);
		expect((result.plans[0] as MembershipPlan).name).toBe("Basic");
	});

	it("returns empty when no active plans exist", async () => {
		const ctrl = createMembershipController(data);
		await createTestPlan(ctrl, { name: "Inactive", isActive: false });

		const result = await simulateListPlans(data);

		expect(result.plans).toHaveLength(0);
	});

	it("returns multiple active plans", async () => {
		const ctrl = createMembershipController(data);
		await createTestPlan(ctrl, { name: "Basic", sortOrder: 1 });
		await createTestPlan(ctrl, { name: "Pro", sortOrder: 2 });
		await createTestPlan(ctrl, { name: "Enterprise", sortOrder: 3 });

		const result = await simulateListPlans(data);

		expect(result.plans).toHaveLength(3);
	});
});

describe("store endpoint: get plan — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active plan by slug", async () => {
		const ctrl = createMembershipController(data);
		await createTestPlan(ctrl, {
			name: "Premium",
			slug: "premium",
			price: 1999,
		});

		const result = await simulateGetPlan(data, "premium");

		expect("plan" in result).toBe(true);
		if ("plan" in result) {
			expect(result.plan.name).toBe("Premium");
			expect(result.plan.price).toBe(1999);
		}
	});

	it("returns 404 for inactive plan", async () => {
		const ctrl = createMembershipController(data);
		await createTestPlan(ctrl, {
			name: "Retired",
			slug: "retired",
			isActive: false,
		});

		const result = await simulateGetPlan(data, "retired");

		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetPlan(data, "nonexistent");

		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});
});

describe("store endpoint: subscribe — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateSubscribe(data, { planId: "plan_1" });
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("subscribes customer to an active plan", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, {
			name: "Pro",
			price: 2999,
		});

		const result = await simulateSubscribe(
			data,
			{ planId: plan.id },
			{ customerId: "cust_1" },
		);

		expect("membership" in result).toBe(true);
		if ("membership" in result) {
			expect(result.membership.customerId).toBe("cust_1");
			expect(result.membership.planId).toBe(plan.id);
		}
	});

	it("returns 404 for inactive plan", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, {
			name: "Hidden",
			isActive: false,
		});

		const result = await simulateSubscribe(
			data,
			{ planId: plan.id },
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});

	it("sets trial status when plan has trial days", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, {
			name: "Trial Plan",
			trialDays: 14,
		});

		const result = await simulateSubscribe(
			data,
			{ planId: plan.id },
			{ customerId: "cust_1" },
		);

		expect("membership" in result).toBe(true);
		if ("membership" in result) {
			expect(result.membership.status).toBe("trial");
		}
	});
});

describe("store endpoint: get my membership — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetMyMembership(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer membership with plan details", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Basic" });
		await ctrl.subscribe({ customerId: "cust_1", planId: plan.id });

		const result = await simulateGetMyMembership(data, {
			customerId: "cust_1",
		});

		expect("membership" in result).toBe(true);
		if ("membership" in result && result.membership) {
			expect(result.membership.customerId).toBe("cust_1");
			expect(result.membership.plan).toBeDefined();
			expect(result.membership.plan.name).toBe("Basic");
		}
	});

	it("returns null for customer without membership", async () => {
		const result = await simulateGetMyMembership(data, {
			customerId: "cust_none",
		});

		expect("membership" in result).toBe(true);
		if ("membership" in result) {
			expect(result.membership).toBeNull();
		}
	});
});

describe("store endpoint: cancel membership — auth + ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCancelMembership(data, "mem_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("cancels an active membership", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Pro" });
		const membership = await ctrl.subscribe({
			customerId: "cust_1",
			planId: plan.id,
		});

		const result = await simulateCancelMembership(data, membership.id, {
			customerId: "cust_1",
		});

		expect("membership" in result).toBe(true);
		if ("membership" in result) {
			expect(result.membership.status).toBe("cancelled");
		}
	});

	it("returns 404 for another customer's membership", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Basic" });
		const membership = await ctrl.subscribe({
			customerId: "cust_1",
			planId: plan.id,
		});

		const result = await simulateCancelMembership(data, membership.id, {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Membership not found", status: 404 });
	});

	it("returns 404 for nonexistent membership", async () => {
		const result = await simulateCancelMembership(data, "ghost_id", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Membership not found", status: 404 });
	});
});

describe("store endpoint: can access product — gating check", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns false for unauthenticated user", async () => {
		const result = await simulateCanAccessProduct(data, "prod_1");
		expect(result.canAccess).toBe(false);
	});

	it("returns true when product is not gated", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Basic" });
		await ctrl.subscribe({ customerId: "cust_1", planId: plan.id });

		const result = await simulateCanAccessProduct(data, "prod_ungated", {
			customerId: "cust_1",
		});

		expect(result.canAccess).toBe(true);
	});

	it("returns true for member with access to gated product", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Pro" });
		await ctrl.subscribe({ customerId: "cust_1", planId: plan.id });
		await ctrl.gateProduct({ planId: plan.id, productId: "prod_exclusive" });

		const result = await simulateCanAccessProduct(data, "prod_exclusive", {
			customerId: "cust_1",
		});

		expect(result.canAccess).toBe(true);
	});

	it("returns false for non-member on gated product", async () => {
		const ctrl = createMembershipController(data);
		const plan = await createTestPlan(ctrl, { name: "Pro" });
		await ctrl.gateProduct({ planId: plan.id, productId: "prod_exclusive" });

		const result = await simulateCanAccessProduct(data, "prod_exclusive", {
			customerId: "cust_no_membership",
		});

		expect(result.canAccess).toBe(false);
	});
});
