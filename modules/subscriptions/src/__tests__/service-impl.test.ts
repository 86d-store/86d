import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createSubscriptionController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

describe("createSubscriptionController", () => {
	// ── Plans ─────────────────────────────────────────────────────────────

	describe("createPlan", () => {
		it("creates a plan with defaults", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Monthly Basic",
				price: 999,
				interval: "month",
			});

			expect(plan.id).toBeDefined();
			expect(plan.name).toBe("Monthly Basic");
			expect(plan.price).toBe(999);
			expect(plan.currency).toBe("USD");
			expect(plan.interval).toBe("month");
			expect(plan.intervalCount).toBe(1);
			expect(plan.isActive).toBe(true);
			expect(plan.createdAt).toBeInstanceOf(Date);
			expect(plan.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a plan with custom options", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Annual Pro",
				description: "Pro plan billed annually",
				price: 9999,
				currency: "EUR",
				interval: "year",
				intervalCount: 1,
				trialDays: 14,
				isActive: false,
			});

			expect(plan.description).toBe("Pro plan billed annually");
			expect(plan.currency).toBe("EUR");
			expect(plan.interval).toBe("year");
			expect(plan.trialDays).toBe(14);
			expect(plan.isActive).toBe(false);
		});

		it("persists the plan so it can be retrieved", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Weekly",
				price: 199,
				interval: "week",
			});
			const fetched = await ctrl.getPlan(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
		});
	});

	describe("getPlan", () => {
		it("returns the plan when found", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Daily",
				price: 99,
				interval: "day",
			});
			const plan = await ctrl.getPlan(created.id);

			expect(plan).not.toBeNull();
			expect(plan?.name).toBe("Daily");
		});

		it("returns null when not found", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.getPlan("nonexistent-id");
			expect(plan).toBeNull();
		});
	});

	describe("listPlans", () => {
		it("returns all plans", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			await ctrl.createPlan({ name: "Plan A", price: 100, interval: "month" });
			await ctrl.createPlan({ name: "Plan B", price: 200, interval: "year" });

			const plans = await ctrl.listPlans();
			expect(plans).toHaveLength(2);
		});

		it("filters by activeOnly", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			await ctrl.createPlan({
				name: "Active Plan",
				price: 100,
				interval: "month",
				isActive: true,
			});
			await ctrl.createPlan({
				name: "Inactive Plan",
				price: 200,
				interval: "year",
				isActive: false,
			});

			const active = await ctrl.listPlans({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active Plan");
		});

		it("returns empty array when no plans", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plans = await ctrl.listPlans();
			expect(plans).toHaveLength(0);
		});

		it("respects take/skip pagination", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			await ctrl.createPlan({ name: "Plan 1", price: 100, interval: "month" });
			await ctrl.createPlan({ name: "Plan 2", price: 200, interval: "month" });
			await ctrl.createPlan({ name: "Plan 3", price: 300, interval: "month" });

			const page1 = await ctrl.listPlans({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listPlans({ take: 2, skip: 2 });
			expect(page2).toHaveLength(1);
		});
	});

	describe("updatePlan", () => {
		it("updates specified fields", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Old Name",
				price: 500,
				interval: "month",
			});
			const updated = await ctrl.updatePlan(created.id, {
				name: "New Name",
				price: 750,
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("New Name");
			expect(updated?.price).toBe(750);
			expect(updated?.interval).toBe("month"); // unchanged
		});

		it("updates isActive flag", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const updated = await ctrl.updatePlan(created.id, { isActive: false });

			expect(updated?.isActive).toBe(false);
		});

		it("updates trialDays", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const updated = await ctrl.updatePlan(created.id, { trialDays: 30 });

			expect(updated?.trialDays).toBe(30);
		});

		it("updates the updatedAt timestamp", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const created = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			await new Promise((r) => setTimeout(r, 5));
			const updated = await ctrl.updatePlan(created.id, { name: "Updated" });

			expect(updated?.updatedAt.getTime()).toBeGreaterThan(
				created.updatedAt.getTime(),
			);
		});

		it("returns null for missing plan", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.updatePlan("nonexistent", { name: "x" });
			expect(result).toBeNull();
		});
	});

	describe("deletePlan", () => {
		it("deletes a plan and returns true", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "To Delete",
				price: 100,
				interval: "month",
			});
			const result = await ctrl.deletePlan(plan.id);

			expect(result).toBe(true);
			const fetched = await ctrl.getPlan(plan.id);
			expect(fetched).toBeNull();
		});

		it("returns true even for nonexistent plan", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.deletePlan("nonexistent");
			expect(result).toBe(true);
		});
	});

	// ── Subscriptions ──────────────────────────────────────────────────────

	describe("subscribe", () => {
		it("creates an active subscription for a plan without trial", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			expect(sub.id).toBeDefined();
			expect(sub.planId).toBe(plan.id);
			expect(sub.email).toBe("user@example.com");
			expect(sub.status).toBe("active");
			expect(sub.trialStart).toBeUndefined();
			expect(sub.trialEnd).toBeUndefined();
			expect(sub.cancelAtPeriodEnd).toBe(false);
		});

		it("creates a trialing subscription for a plan with trialDays", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Monthly with Trial",
				price: 999,
				interval: "month",
				trialDays: 7,
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});

			expect(sub.status).toBe("trialing");
			expect(sub.trialStart).toBeInstanceOf(Date);
			expect(sub.trialEnd).toBeInstanceOf(Date);
			// trial end should be ~7 days after start
			const diffDays =
				((sub.trialEnd as Date).getTime() -
					(sub.trialStart as Date).getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});

		it("sets currentPeriodStart and currentPeriodEnd based on interval", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Weekly",
				price: 199,
				interval: "week",
				intervalCount: 2,
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const diffDays =
				(sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(14, 0); // 2 weeks
		});

		it("stores customerId when provided", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "cust@example.com",
				customerId: "cust-123",
			});

			expect(sub.customerId).toBe("cust-123");
		});

		it("throws when plan not found", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			await expect(
				ctrl.subscribe({ planId: "nonexistent", email: "user@example.com" }),
			).rejects.toThrow("Plan not found");
		});

		it("throws when plan is inactive", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Inactive",
				price: 100,
				interval: "month",
				isActive: false,
			});
			await expect(
				ctrl.subscribe({ planId: plan.id, email: "user@example.com" }),
			).rejects.toThrow("Plan is not active");
		});
	});

	describe("getSubscription", () => {
		it("returns subscription when found", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const created = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const fetched = await ctrl.getSubscription(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
		});

		it("returns null when not found", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.getSubscription("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getSubscriptionByEmail", () => {
		it("returns subscription for matching email", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			await ctrl.subscribe({ planId: plan.id, email: "target@example.com" });
			await ctrl.subscribe({ planId: plan.id, email: "other@example.com" });

			const sub = await ctrl.getSubscriptionByEmail({
				email: "target@example.com",
			});
			expect(sub).not.toBeNull();
			expect(sub?.email).toBe("target@example.com");
		});

		it("filters by planId when provided", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const planA = await ctrl.createPlan({
				name: "Plan A",
				price: 100,
				interval: "month",
			});
			const planB = await ctrl.createPlan({
				name: "Plan B",
				price: 200,
				interval: "year",
			});
			await ctrl.subscribe({ planId: planA.id, email: "user@example.com" });
			await ctrl.subscribe({ planId: planB.id, email: "user@example.com" });

			const sub = await ctrl.getSubscriptionByEmail({
				email: "user@example.com",
				planId: planB.id,
			});
			expect(sub).not.toBeNull();
			expect(sub?.planId).toBe(planB.id);
		});

		it("returns null when no match", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.getSubscriptionByEmail({
				email: "nobody@example.com",
			});
			expect(result).toBeNull();
		});
	});

	describe("cancelSubscription", () => {
		it("immediately cancels a subscription", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const cancelled = await ctrl.cancelSubscription({ id: sub.id });

			expect(cancelled).not.toBeNull();
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled?.cancelAtPeriodEnd).toBe(false);
		});

		it("sets cancelAtPeriodEnd flag without changing status", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const result = await ctrl.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});

			expect(result).not.toBeNull();
			expect(result?.cancelAtPeriodEnd).toBe(true);
			expect(result?.status).toBe("active"); // still active
			expect(result?.cancelledAt).toBeUndefined();
		});

		it("returns null for nonexistent subscription", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.cancelSubscription({ id: "nonexistent" });
			expect(result).toBeNull();
		});
	});

	describe("renewSubscription", () => {
		it("advances period dates and sets status to active", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const originalEnd = sub.currentPeriodEnd;
			const renewed = await ctrl.renewSubscription(sub.id);

			expect(renewed).not.toBeNull();
			expect(renewed?.status).toBe("active");
			expect(renewed?.currentPeriodStart.getTime()).toBe(originalEnd.getTime());
			expect(renewed?.currentPeriodEnd.getTime()).toBeGreaterThan(
				originalEnd.getTime(),
			);
			expect(renewed?.cancelAtPeriodEnd).toBe(false);
		});

		it("returns null for nonexistent subscription", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const result = await ctrl.renewSubscription("nonexistent");
			expect(result).toBeNull();
		});

		it("returns null when plan is missing", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Delete the plan
			await ctrl.deletePlan(plan.id);

			const result = await ctrl.renewSubscription(sub.id);
			expect(result).toBeNull();
		});
	});

	describe("expireSubscriptions", () => {
		it("expires past-due active subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			// Create a plan with a very short interval (day) and manually backdate
			const plan = await ctrl.createPlan({
				name: "Daily",
				price: 99,
				interval: "day",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Manually backdate the subscription's period end to the past
			const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
			await data.upsert("subscription", sub.id, {
				...(sub as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(1);

			const expired = await ctrl.getSubscription(sub.id);
			expect(expired?.status).toBe("expired");
		});

		it("does not expire future subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			await ctrl.subscribe({ planId: plan.id, email: "user@example.com" });

			// Period end is in the future (default behavior)
			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(0);
		});

		it("also expires past-due trialing subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Trial Plan",
				price: 999,
				interval: "month",
				trialDays: 7,
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});
			expect(sub.status).toBe("trialing");

			// Backdate period end
			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await data.upsert("subscription", sub.id, {
				...(sub as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(1);

			const expired = await ctrl.getSubscription(sub.id);
			expect(expired?.status).toBe("expired");
		});

		it("does not expire already cancelled or expired subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Cancel first
			await ctrl.cancelSubscription({ id: sub.id });

			// Backdate period end
			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const cancelled = await ctrl.getSubscription(sub.id);
			await data.upsert("subscription", sub.id, {
				...(cancelled as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(0); // cancelled subs not touched
		});

		it("returns 0 when nothing to expire", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(0);
		});
	});

	describe("listSubscriptions", () => {
		it("returns all subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			await ctrl.subscribe({ planId: plan.id, email: "a@example.com" });
			await ctrl.subscribe({ planId: plan.id, email: "b@example.com" });

			const subs = await ctrl.listSubscriptions();
			expect(subs).toHaveLength(2);
		});

		it("filters by email", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			await ctrl.subscribe({ planId: plan.id, email: "target@example.com" });
			await ctrl.subscribe({ planId: plan.id, email: "other@example.com" });

			const subs = await ctrl.listSubscriptions({
				email: "target@example.com",
			});
			expect(subs).toHaveLength(1);
			expect(subs[0].email).toBe("target@example.com");
		});

		it("filters by planId", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const planA = await ctrl.createPlan({
				name: "Plan A",
				price: 100,
				interval: "month",
			});
			const planB = await ctrl.createPlan({
				name: "Plan B",
				price: 200,
				interval: "year",
			});
			await ctrl.subscribe({ planId: planA.id, email: "a@example.com" });
			await ctrl.subscribe({ planId: planB.id, email: "b@example.com" });

			const subs = await ctrl.listSubscriptions({ planId: planA.id });
			expect(subs).toHaveLength(1);
			expect(subs[0].planId).toBe(planA.id);
		});

		it("filters by status", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub1 = await ctrl.subscribe({
				planId: plan.id,
				email: "a@example.com",
			});
			await ctrl.subscribe({ planId: plan.id, email: "b@example.com" });

			await ctrl.cancelSubscription({ id: sub1.id });

			const cancelled = await ctrl.listSubscriptions({ status: "cancelled" });
			expect(cancelled).toHaveLength(1);

			const active = await ctrl.listSubscriptions({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("returns empty array when no subscriptions", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const subs = await ctrl.listSubscriptions();
			expect(subs).toHaveLength(0);
		});

		it("respects take/skip pagination", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			await ctrl.subscribe({ planId: plan.id, email: "a@example.com" });
			await ctrl.subscribe({ planId: plan.id, email: "b@example.com" });
			await ctrl.subscribe({ planId: plan.id, email: "c@example.com" });

			const page1 = await ctrl.listSubscriptions({ take: 2 });
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listSubscriptions({ take: 2, skip: 2 });
			expect(page2).toHaveLength(1);
		});
	});

	// ── Event emission ──────────────────────────────────────────────────

	describe("event emission", () => {
		it("emits subscription.created on subscribe", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createSubscriptionController(data, events);

			const plan = await ctrl.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
				customerId: "cust-1",
			});

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].type).toBe("subscription.created");
			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.subscriptionId).toBe(sub.id);
			expect(payload.planId).toBe(plan.id);
			expect(payload.planName).toBe("Monthly");
			expect(payload.email).toBe("user@example.com");
			expect(payload.customerId).toBe("cust-1");
			expect(payload.status).toBe("active");
			expect(payload.price).toBe(999);
			expect(payload.currency).toBe("USD");
		});

		it("emits subscription.cancelled on immediate cancel", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createSubscriptionController(data, events);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			events.emitted.length = 0; // clear subscribe event

			await ctrl.cancelSubscription({ id: sub.id });

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].type).toBe("subscription.cancelled");
			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.subscriptionId).toBe(sub.id);
			expect(payload.email).toBe("user@example.com");
			expect(payload.cancelledAt).toBeInstanceOf(Date);
		});

		it("does not emit subscription.cancelled for cancelAtPeriodEnd", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createSubscriptionController(data, events);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			events.emitted.length = 0;

			await ctrl.cancelSubscription({ id: sub.id, cancelAtPeriodEnd: true });

			expect(events.emitted).toHaveLength(0);
		});

		it("emits subscription.renewed on renew", async () => {
			const data = createMockDataService();
			const events = createMockEvents();
			const ctrl = createSubscriptionController(data, events);

			const plan = await ctrl.createPlan({
				name: "Weekly",
				price: 499,
				interval: "week",
			});
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "renew@example.com",
			});
			events.emitted.length = 0;

			const renewed = await ctrl.renewSubscription(sub.id);

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].type).toBe("subscription.renewed");
			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.subscriptionId).toBe(sub.id);
			expect(payload.planName).toBe("Weekly");
			expect(payload.email).toBe("renew@example.com");
			expect(payload.currentPeriodStart).toEqual(renewed?.currentPeriodStart);
			expect(payload.currentPeriodEnd).toEqual(renewed?.currentPeriodEnd);
		});

		it("does not emit events without ScopedEventEmitter", async () => {
			const data = createMockDataService();
			const ctrl = createSubscriptionController(data);

			const plan = await ctrl.createPlan({
				name: "Plan",
				price: 100,
				interval: "month",
			});
			// These should not throw
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await ctrl.cancelSubscription({ id: sub.id });
		});
	});
});
