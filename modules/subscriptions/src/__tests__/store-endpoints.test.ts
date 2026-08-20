import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { SubscriptionController } from "../service";
import { createSubscriptionController } from "../service-impl";

/**
 * Store endpoint integration tests for the subscriptions module.
 *
 * Tests verify:
 *
 * 1. list-plans — returns only active plans, no auth required
 * 2. subscribe — auth, plan existence, plan active check, trial handling
 * 3. get-my-subscriptions — auth, scoped to customer, enriched with plan name
 * 4. cancel — auth, ownership, immediate vs. end-of-period cancellation
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateListPlans(controller: SubscriptionController) {
	const plans = await controller.listPlans({ activeOnly: true });
	return { plans };
}

async function simulateGetMySubscriptions(
	controller: SubscriptionController,
	session: { userId: string; email: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const subscriptions = await controller.listSubscriptions({
		email: session.email,
	});
	const planIds = [...new Set(subscriptions.map((s) => s.planId))];
	const planMap = new Map<string, string>();
	await Promise.all(
		planIds.map(async (planId) => {
			const plan = await controller.getPlan(planId);
			if (plan) planMap.set(planId, plan.name);
		}),
	);
	const enriched = subscriptions.map((s) => ({
		...s,
		planName: planMap.get(s.planId),
	}));
	return { subscriptions: enriched };
}

async function simulateSubscribe(
	controller: SubscriptionController,
	body: { planId: string },
	session: { userId: string; email: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };

	const plan = await controller.getPlan(body.planId);
	if (!plan) return { error: "Plan not found", status: 404 };
	if (!plan.isActive) return { error: "Plan is not active", status: 400 };

	const subscription = await controller.subscribe({
		planId: body.planId,
		customerId: session.userId,
		email: session.email,
	});
	return { subscription };
}

async function simulateCancel(
	controller: SubscriptionController,
	body: { id: string; cancelAtPeriodEnd?: boolean },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const existing = await controller.getSubscription(body.id);
	if (!existing || existing.customerId !== session.userId) {
		return { error: "Not found", status: 404 };
	}
	const subscription = await controller.cancelSubscription({
		id: body.id,
		cancelAtPeriodEnd: body.cancelAtPeriodEnd,
	});
	return { subscription };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: SubscriptionController;

beforeEach(() => {
	data = createMockDataService();
	controller = createSubscriptionController(data);
});

const session = { userId: "cust_1", email: "cust@example.com" };

describe("list-plans (GET /subscriptions/plans)", () => {
	it("returns empty list when no plans exist", async () => {
		const result = await simulateListPlans(controller);
		expect(result.plans).toHaveLength(0);
	});

	it("returns only active plans", async () => {
		await controller.createPlan({
			name: "Active Monthly",
			price: 999,
			interval: "month",
			isActive: true,
		});
		await controller.createPlan({
			name: "Retired Yearly",
			price: 4999,
			interval: "year",
			isActive: false,
		});

		const result = await simulateListPlans(controller);
		expect(result.plans).toHaveLength(1);
		expect(result.plans[0].name).toBe("Active Monthly");
	});

	it("returns plan fields needed for display", async () => {
		await controller.createPlan({
			name: "Pro Plan",
			description: "Full access",
			price: 1999,
			currency: "USD",
			interval: "month",
			intervalCount: 1,
			trialDays: 7,
		});

		const result = await simulateListPlans(controller);
		const plan = result.plans[0];
		expect(plan).toMatchObject({
			name: "Pro Plan",
			description: "Full access",
			price: 1999,
			currency: "USD",
			interval: "month",
			intervalCount: 1,
			trialDays: 7,
			isActive: true,
		});
		expect(plan.id).toBeDefined();
	});

	it("does not require authentication", async () => {
		// Public endpoint — no session required
		await controller.createPlan({ name: "Free", price: 0, interval: "month" });
		const result = await simulateListPlans(controller);
		expect(result.plans).toHaveLength(1);
	});
});

describe("subscribe (POST /subscriptions/subscribe)", () => {
	it("requires authentication", async () => {
		const result = await simulateSubscribe(
			controller,
			{ planId: "plan_1" },
			null,
		);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("creates subscription for an active plan", async () => {
		const plan = await controller.createPlan({
			name: "Monthly",
			price: 999,
			interval: "month",
		});

		const result = await simulateSubscribe(
			controller,
			{ planId: plan.id },
			session,
		);
		expect("subscription" in result).toBe(true);
		if ("subscription" in result && result.subscription) {
			expect(result.subscription.planId).toBe(plan.id);
			expect(result.subscription.status).toBe("active");
			expect(result.subscription.email).toBe("cust@example.com");
			expect(result.subscription.customerId).toBe("cust_1");
		}
	});

	it("starts with trialing status when plan has trial days", async () => {
		const plan = await controller.createPlan({
			name: "Trial Plan",
			price: 1999,
			interval: "month",
			trialDays: 14,
		});

		const result = await simulateSubscribe(
			controller,
			{ planId: plan.id },
			session,
		);
		if ("subscription" in result && result.subscription) {
			expect(result.subscription.status).toBe("trialing");
			expect(result.subscription.trialStart).toBeDefined();
			expect(result.subscription.trialEnd).toBeDefined();
		}
	});

	it("returns 404 for non-existent plan", async () => {
		const result = await simulateSubscribe(
			controller,
			{ planId: "nonexistent" },
			session,
		);
		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});

	it("returns 400 for inactive plan", async () => {
		const plan = await controller.createPlan({
			name: "Retired",
			price: 500,
			interval: "year",
			isActive: false,
		});

		const result = await simulateSubscribe(
			controller,
			{ planId: plan.id },
			session,
		);
		expect(result).toEqual({ error: "Plan is not active", status: 400 });
	});
});

describe("get-my-subscriptions (GET /subscriptions/me)", () => {
	it("requires authentication", async () => {
		const result = await simulateGetMySubscriptions(controller, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns subscriptions for the authenticated user's email", async () => {
		const plan = await controller.createPlan({
			name: "Pro",
			price: 2999,
			interval: "month",
		});

		await controller.subscribe({
			planId: plan.id,
			customerId: "cust_1",
			email: "cust@example.com",
		});
		await controller.subscribe({
			planId: plan.id,
			customerId: "cust_2",
			email: "other@example.com",
		});

		const result = await simulateGetMySubscriptions(controller, session);
		expect("subscriptions" in result).toBe(true);
		if ("subscriptions" in result) {
			expect(result.subscriptions).toHaveLength(1);
			expect(result.subscriptions[0].email).toBe("cust@example.com");
		}
	});

	it("enriches subscriptions with plan name", async () => {
		const plan = await controller.createPlan({
			name: "Enterprise",
			price: 9999,
			interval: "month",
		});
		await controller.subscribe({
			planId: plan.id,
			customerId: "cust_1",
			email: "cust@example.com",
		});

		const result = await simulateGetMySubscriptions(controller, session);
		if ("subscriptions" in result) {
			expect(result.subscriptions[0].planName).toBe("Enterprise");
		}
	});

	it("returns empty list when user has no subscriptions", async () => {
		const result = await simulateGetMySubscriptions(controller, session);
		if ("subscriptions" in result) {
			expect(result.subscriptions).toHaveLength(0);
		}
	});
});

describe("cancel (POST /subscriptions/me/cancel)", () => {
	it("requires authentication", async () => {
		const result = await simulateCancel(controller, { id: "sub_1" }, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("cancels subscription immediately", async () => {
		const plan = await controller.createPlan({
			name: "Basic",
			price: 499,
			interval: "month",
		});
		const sub = await controller.subscribe({
			planId: plan.id,
			customerId: "cust_1",
			email: "cust@example.com",
		});

		const result = await simulateCancel(
			controller,
			{ id: sub.id },
			{ userId: "cust_1" },
		);
		expect("subscription" in result).toBe(true);
		if ("subscription" in result && result.subscription) {
			expect(result.subscription.status).toBe("cancelled");
			expect(result.subscription.cancelledAt).toBeDefined();
		}
	});

	it("cancels at period end when requested", async () => {
		const plan = await controller.createPlan({
			name: "Basic",
			price: 499,
			interval: "month",
		});
		const sub = await controller.subscribe({
			planId: plan.id,
			customerId: "cust_1",
			email: "cust@example.com",
		});

		const result = await simulateCancel(
			controller,
			{ id: sub.id, cancelAtPeriodEnd: true },
			{ userId: "cust_1" },
		);
		if ("subscription" in result && result.subscription) {
			expect(result.subscription.cancelAtPeriodEnd).toBe(true);
			// Status remains active until period ends
			expect(result.subscription.status).toBe("active");
		}
	});

	it("returns 404 for another customer's subscription", async () => {
		const plan = await controller.createPlan({
			name: "Basic",
			price: 499,
			interval: "month",
		});
		const sub = await controller.subscribe({
			planId: plan.id,
			customerId: "cust_1",
			email: "cust@example.com",
		});

		const result = await simulateCancel(
			controller,
			{ id: sub.id },
			{ userId: "cust_2" },
		);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});

	it("returns 404 for non-existent subscription", async () => {
		const result = await simulateCancel(
			controller,
			{ id: "nonexistent" },
			{ userId: "cust_1" },
		);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("cross-endpoint lifecycle", () => {
	it("subscribe → list → cancel → list shows cancelled", async () => {
		const plan = await controller.createPlan({
			name: "Premium",
			price: 4999,
			interval: "year",
		});

		// Subscribe
		const subResult = await simulateSubscribe(
			controller,
			{ planId: plan.id },
			session,
		);
		expect("subscription" in subResult).toBe(true);
		const subId =
			"subscription" in subResult ? subResult.subscription?.id : undefined;
		expect(subId).toBeDefined();

		// List shows active subscription
		const listed = await simulateGetMySubscriptions(controller, session);
		if ("subscriptions" in listed) {
			expect(listed.subscriptions).toHaveLength(1);
			expect(listed.subscriptions[0].status).toBe("active");
		}

		// Cancel
		const cancelled = await simulateCancel(
			controller,
			{ id: subId as string },
			{ userId: "cust_1" },
		);
		if ("subscription" in cancelled && cancelled.subscription) {
			expect(cancelled.subscription.status).toBe("cancelled");
		}

		// List still shows it (now cancelled)
		const afterCancel = await simulateGetMySubscriptions(controller, session);
		if ("subscriptions" in afterCancel) {
			expect(afterCancel.subscriptions).toHaveLength(1);
			expect(afterCancel.subscriptions[0].status).toBe("cancelled");
		}
	});
});
