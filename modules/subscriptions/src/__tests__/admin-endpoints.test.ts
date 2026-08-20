import { describe, expect, it, vi } from "vitest";
import { adminCancelSubscription } from "../admin/endpoints/cancel-subscription";
import { createPlan } from "../admin/endpoints/create-plan";
import { deletePlan } from "../admin/endpoints/delete-plan";
import { getSubscription } from "../admin/endpoints/get-subscription";
import { listPlans } from "../admin/endpoints/list-plans";
import { listSubscriptions } from "../admin/endpoints/list-subscriptions";
import { adminRenewSubscription } from "../admin/endpoints/renew-subscription";
import { updatePlan } from "../admin/endpoints/update-plan";
import type {
	Subscription,
	SubscriptionController,
	SubscriptionPlan,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Monthly Plan",
		price: 999,
		currency: "USD",
		interval: "month",
		intervalCount: 1,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		planId: "plan_1",
		email: "alice@example.com",
		status: "active",
		currentPeriodStart: now,
		currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
		cancelAtPeriodEnd: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<SubscriptionController> = {},
): SubscriptionController {
	return {
		createPlan: vi.fn().mockResolvedValue(makePlan()),
		getPlan: vi.fn().mockResolvedValue(null),
		listPlans: vi.fn().mockResolvedValue([]),
		updatePlan: vi.fn().mockResolvedValue(null),
		deletePlan: vi.fn().mockResolvedValue(false),
		subscribe: vi.fn().mockResolvedValue(makeSubscription()),
		getSubscription: vi.fn().mockResolvedValue(null),
		getSubscriptionByEmail: vi.fn().mockResolvedValue(null),
		cancelSubscription: vi.fn().mockResolvedValue(null),
		renewSubscription: vi.fn().mockResolvedValue(null),
		expireSubscriptions: vi.fn().mockResolvedValue(0),
		listSubscriptions: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SubscriptionController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { subscriptions: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listSubscriptions);
const getHandler = extractHandler(getSubscription);
const cancelHandler = extractHandler(adminCancelSubscription);
const renewHandler = extractHandler(adminRenewSubscription);
const listPlansHandler = extractHandler(listPlans);
const createPlanHandler = extractHandler(createPlan);
const updatePlanHandler = extractHandler(updatePlan);
const deletePlanHandler = extractHandler(deletePlan);

describe("admin GET /subscriptions", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			subscriptions: Subscription[];
			total: number;
		};
		expect(result.subscriptions).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns subscriptions from controller", async () => {
		const subs = [makeSubscription(), makeSubscription()];
		const ctrl = makeController({
			listSubscriptions: vi.fn().mockResolvedValue(subs),
		});
		const result = (await call(listHandler, {
			controller: ctrl,
		})) as { subscriptions: Subscription[]; total: number };
		expect(result.subscriptions).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "cancelled" },
			controller: ctrl,
		});
		expect(ctrl.listSubscriptions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "cancelled" }),
		);
	});
});

describe("admin GET /subscriptions/:id", () => {
	it("returns null subscription when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { subscription: Subscription | null };
		expect(result.subscription).toBeNull();
	});

	it("returns subscription when found", async () => {
		const sub = makeSubscription({ id: "sub_1" });
		const ctrl = makeController({
			getSubscription: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(getHandler, {
			params: { id: "sub_1" },
			controller: ctrl,
		})) as { subscription: Subscription };
		expect(result.subscription.id).toBe("sub_1");
		expect(ctrl.getSubscription).toHaveBeenCalledWith("sub_1");
	});
});

describe("admin POST /subscriptions/:id/cancel", () => {
	it("returns 404 when subscription not found", async () => {
		const result = (await call(cancelHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.error).toBe("Subscription not found");
		expect(result.status).toBe(404);
	});

	it("cancels subscription and returns it", async () => {
		const sub = makeSubscription({ status: "cancelled" });
		const ctrl = makeController({
			cancelSubscription: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(cancelHandler, {
			params: { id: sub.id },
			body: {},
			controller: ctrl,
		})) as { subscription: Subscription };
		expect(result.subscription.status).toBe("cancelled");
		expect(ctrl.cancelSubscription).toHaveBeenCalledWith(
			expect.objectContaining({ id: sub.id }),
		);
	});

	it("passes cancelAtPeriodEnd to controller", async () => {
		const sub = makeSubscription({ cancelAtPeriodEnd: true });
		const ctrl = makeController({
			cancelSubscription: vi.fn().mockResolvedValue(sub),
		});
		await call(cancelHandler, {
			params: { id: sub.id },
			body: { cancelAtPeriodEnd: true },
			controller: ctrl,
		});
		expect(ctrl.cancelSubscription).toHaveBeenCalledWith(
			expect.objectContaining({ cancelAtPeriodEnd: true }),
		);
	});
});

describe("admin POST /subscriptions/:id/renew", () => {
	it("returns 404 when subscription not found", async () => {
		const result = (await call(renewHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Subscription not found");
		expect(result.status).toBe(404);
	});

	it("renews subscription and returns it", async () => {
		const sub = makeSubscription({ status: "active" });
		const ctrl = makeController({
			renewSubscription: vi.fn().mockResolvedValue(sub),
		});
		const result = (await call(renewHandler, {
			params: { id: sub.id },
			controller: ctrl,
		})) as { subscription: Subscription };
		expect(result.subscription.status).toBe("active");
		expect(ctrl.renewSubscription).toHaveBeenCalledWith(sub.id);
	});
});

describe("admin GET /subscriptions/plans", () => {
	it("returns empty plans list", async () => {
		const result = (await call(listPlansHandler)) as {
			plans: SubscriptionPlan[];
		};
		expect(result.plans).toHaveLength(0);
	});

	it("returns plans from controller", async () => {
		const plans = [
			makePlan(),
			makePlan({ name: "Yearly Plan", interval: "year" }),
		];
		const ctrl = makeController({
			listPlans: vi.fn().mockResolvedValue(plans),
		});
		const result = (await call(listPlansHandler, {
			controller: ctrl,
		})) as { plans: SubscriptionPlan[] };
		expect(result.plans).toHaveLength(2);
	});

	it("forwards activeOnly filter", async () => {
		const ctrl = makeController();
		await call(listPlansHandler, {
			query: { activeOnly: "true" },
			controller: ctrl,
		});
		expect(ctrl.listPlans).toHaveBeenCalledWith(
			expect.objectContaining({ activeOnly: true }),
		);
	});
});

describe("admin POST /subscriptions/plans/create", () => {
	it("creates a plan and returns it", async () => {
		const plan = makePlan({ name: "Weekly Plan", interval: "week" });
		const ctrl = makeController({
			createPlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(createPlanHandler, {
			body: {
				name: "Weekly Plan",
				price: 499,
				currency: "USD",
				interval: "week",
				intervalCount: 1,
			},
			controller: ctrl,
		})) as { plan: SubscriptionPlan };
		expect(result.plan.name).toBe("Weekly Plan");
		expect(result.plan.interval).toBe("week");
		expect(ctrl.createPlan).toHaveBeenCalledWith(
			expect.objectContaining({ interval: "week" }),
		);
	});
});

describe("admin PUT /subscriptions/plans/:id/update", () => {
	it("returns null plan when not found", async () => {
		const result = (await call(updatePlanHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { plan: SubscriptionPlan | null };
		expect(result.plan).toBeNull();
	});

	it("updates plan and returns it", async () => {
		const plan = makePlan({ name: "Updated Plan", price: 1299 });
		const ctrl = makeController({
			updatePlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(updatePlanHandler, {
			params: { id: plan.id },
			body: { name: "Updated Plan", price: 1299 },
			controller: ctrl,
		})) as { plan: SubscriptionPlan };
		expect(result.plan.name).toBe("Updated Plan");
		expect(result.plan.price).toBe(1299);
		expect(ctrl.updatePlan).toHaveBeenCalledWith(
			plan.id,
			expect.objectContaining({ name: "Updated Plan", price: 1299 }),
		);
	});
});

describe("admin DELETE /subscriptions/plans/:id/delete", () => {
	it("returns ok=false when plan not found", async () => {
		const result = (await call(deletePlanHandler, {
			params: { id: "missing" },
		})) as { ok: boolean };
		expect(result.ok).toBe(false);
	});

	it("returns ok=true when plan deleted", async () => {
		const ctrl = makeController({
			deletePlan: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePlanHandler, {
			params: { id: "plan_1" },
			controller: ctrl,
		})) as { ok: boolean };
		expect(result.ok).toBe(true);
		expect(ctrl.deletePlan).toHaveBeenCalledWith("plan_1");
	});
});
