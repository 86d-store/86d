import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubscriptionController } from "../service-impl";

// ── Helpers ───────────────────────────────────────────────────────────────

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

function planParams(
	overrides: Partial<
		Parameters<ReturnType<typeof createSubscriptionController>["createPlan"]>[0]
	> = {},
) {
	return {
		name: "Default Plan",
		price: 999,
		interval: "month" as const,
		...overrides,
	};
}

// ── Edge-case tests ──────────────────────────────────────────────────────

describe("subscriptions controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let ctrl: ReturnType<typeof createSubscriptionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		ctrl = createSubscriptionController(mockData);
	});

	// ── calculateNextPeriod interval coverage ────────────────────────

	describe("period calculation — all intervals", () => {
		it("calculates daily interval correctly", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "day", intervalCount: 3 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const diffMs =
				sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(3, 0);
		});

		it("calculates weekly interval correctly", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "week", intervalCount: 1 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const diffDays =
				(sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});

		it("calculates monthly interval correctly", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "month", intervalCount: 1 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Monthly = 28–31 days
			const diffDays =
				(sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeGreaterThanOrEqual(28);
			expect(diffDays).toBeLessThanOrEqual(31);
		});

		it("calculates yearly interval correctly", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "year", intervalCount: 1 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const diffDays =
				(sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeGreaterThanOrEqual(365);
			expect(diffDays).toBeLessThanOrEqual(366);
		});

		it("handles multi-month intervalCount", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "month", intervalCount: 3 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const expectedEnd = new Date(sub.currentPeriodStart);
			expectedEnd.setMonth(expectedEnd.getMonth() + 3);
			expect(sub.currentPeriodEnd).toEqual(expectedEnd);
		});

		it("renewal uses currentPeriodEnd as new start", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "week", intervalCount: 2 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const renewed = await ctrl.renewSubscription(sub.id);
			expect(renewed).not.toBeNull();
			const r = renewed as NonNullable<typeof renewed>;
			expect(r.currentPeriodStart.getTime()).toBe(
				sub.currentPeriodEnd.getTime(),
			);

			// New period is 2 weeks from old end
			const diffDays =
				(r.currentPeriodEnd.getTime() - r.currentPeriodStart.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(14, 0);
		});
	});

	// ── Plan CRUD edge cases ─────────────────────────────────────────

	describe("plan edge cases", () => {
		it("creates plans with zero price (free plan)", async () => {
			const plan = await ctrl.createPlan(planParams({ price: 0 }));
			expect(plan.price).toBe(0);
		});

		it("preserves undefined description", async () => {
			const plan = await ctrl.createPlan(planParams());
			expect(plan.description).toBeUndefined();
		});

		it("preserves explicit description", async () => {
			const plan = await ctrl.createPlan(
				planParams({ description: "A great plan" }),
			);
			expect(plan.description).toBe("A great plan");
		});

		it("update preserves description when not specified in update", async () => {
			const plan = await ctrl.createPlan(
				planParams({ description: "Original" }),
			);
			const updated = await ctrl.updatePlan(plan.id, { name: "New Name" });
			expect(updated?.description).toBe("Original");
		});

		it("passing undefined for description preserves existing value", async () => {
			const plan = await ctrl.createPlan(
				planParams({ description: "Keep me" }),
			);
			const updated = await ctrl.updatePlan(plan.id, {
				description: undefined,
			});
			expect(updated?.description).toBe("Keep me");
		});

		it("update preserves immutable fields (currency, interval, intervalCount)", async () => {
			const plan = await ctrl.createPlan(
				planParams({
					currency: "GBP",
					interval: "year",
					intervalCount: 2,
				}),
			);
			const updated = await ctrl.updatePlan(plan.id, {
				name: "Changed Name",
			});
			expect(updated?.currency).toBe("GBP");
			expect(updated?.interval).toBe("year");
			expect(updated?.intervalCount).toBe(2);
		});

		it("update preserves createdAt", async () => {
			const plan = await ctrl.createPlan(planParams());
			await new Promise((r) => setTimeout(r, 5));
			const updated = await ctrl.updatePlan(plan.id, { name: "Refreshed" });
			expect(updated?.createdAt.getTime()).toBe(plan.createdAt.getTime());
		});

		it("listPlans with take=0 returns empty", async () => {
			await ctrl.createPlan(planParams({ name: "Plan A" }));
			await ctrl.createPlan(planParams({ name: "Plan B" }));
			const plans = await ctrl.listPlans({ take: 0 });
			expect(plans).toHaveLength(0);
		});

		it("delete does not affect other plans", async () => {
			const planA = await ctrl.createPlan(planParams({ name: "A" }));
			const planB = await ctrl.createPlan(planParams({ name: "B" }));
			await ctrl.deletePlan(planA.id);

			expect(await ctrl.getPlan(planA.id)).toBeNull();
			expect(await ctrl.getPlan(planB.id)).not.toBeNull();
		});
	});

	// ── Subscribe edge cases ─────────────────────────────────────────

	describe("subscribe edge cases", () => {
		it("allows same email to subscribe to different plans", async () => {
			const planA = await ctrl.createPlan(
				planParams({ name: "Plan A", interval: "month" }),
			);
			const planB = await ctrl.createPlan(
				planParams({ name: "Plan B", interval: "year" }),
			);

			const subA = await ctrl.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			const subB = await ctrl.subscribe({
				planId: planB.id,
				email: "user@example.com",
			});

			expect(subA.id).not.toBe(subB.id);
			expect(subA.planId).toBe(planA.id);
			expect(subB.planId).toBe(planB.id);
		});

		it("allows same email to subscribe to same plan twice", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub1 = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const sub2 = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			expect(sub1.id).not.toBe(sub2.id);
		});

		it("subscription with trial has trialEnd ~N days from trialStart", async () => {
			const plan = await ctrl.createPlan(
				planParams({ trialDays: 14, interval: "month" }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});

			expect(sub.status).toBe("trialing");
			const diffDays =
				((sub.trialEnd as Date).getTime() -
					(sub.trialStart as Date).getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(14, 0);
		});

		it("subscription without customerId has customerId undefined", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "anon@example.com",
			});
			expect(sub.customerId).toBeUndefined();
		});

		it("subscription with trialDays=0 is active (not trialing)", async () => {
			const plan = await ctrl.createPlan(planParams({ trialDays: 0 }));
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			expect(sub.status).toBe("active");
			expect(sub.trialStart).toBeUndefined();
		});
	});

	// ── Cancel edge cases ────────────────────────────────────────────

	describe("cancel edge cases", () => {
		it("cancelling a trialing subscription sets status to cancelled", async () => {
			const plan = await ctrl.createPlan(
				planParams({ trialDays: 7, interval: "month" }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});
			expect(sub.status).toBe("trialing");

			const cancelled = await ctrl.cancelSubscription({ id: sub.id });
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
		});

		it("cancelAtPeriodEnd preserves trialing status", async () => {
			const plan = await ctrl.createPlan(
				planParams({ trialDays: 7, interval: "month" }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});

			const result = await ctrl.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});
			expect(result?.status).toBe("trialing");
			expect(result?.cancelAtPeriodEnd).toBe(true);
		});

		it("cancelling already cancelled subscription re-sets cancelledAt", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const first = await ctrl.cancelSubscription({ id: sub.id });
			await new Promise((r) => setTimeout(r, 5));
			const second = await ctrl.cancelSubscription({ id: sub.id });

			expect(second?.status).toBe("cancelled");
			expect(second?.cancelledAt).toBeInstanceOf(Date);
			// cancelledAt may differ from first cancellation
			const firstTime = first?.cancelledAt?.getTime() ?? 0;
			const secondTime = second?.cancelledAt?.getTime() ?? 0;
			expect(secondTime).toBeGreaterThanOrEqual(firstTime);
		});

		it("cancel does not affect other subscriptions", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub1 = await ctrl.subscribe({
				planId: plan.id,
				email: "a@example.com",
			});
			const sub2 = await ctrl.subscribe({
				planId: plan.id,
				email: "b@example.com",
			});

			await ctrl.cancelSubscription({ id: sub1.id });

			const fetched2 = await ctrl.getSubscription(sub2.id);
			expect(fetched2?.status).toBe("active");
		});
	});

	// ── Renew edge cases ─────────────────────────────────────────────

	describe("renew edge cases", () => {
		it("renewing a cancelled subscription reactivates it", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await ctrl.cancelSubscription({ id: sub.id });

			const renewed = await ctrl.renewSubscription(sub.id);
			expect(renewed?.status).toBe("active");
			expect(renewed?.cancelAtPeriodEnd).toBe(false);
		});

		it("renewing clears cancelAtPeriodEnd flag", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await ctrl.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});

			const renewed = await ctrl.renewSubscription(sub.id);
			expect(renewed?.cancelAtPeriodEnd).toBe(false);
		});

		it("double renewal advances period twice", async () => {
			const plan = await ctrl.createPlan(
				planParams({ interval: "month", intervalCount: 1 }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const first = await ctrl.renewSubscription(sub.id);
			const second = await ctrl.renewSubscription(sub.id);

			expect(second).not.toBeNull();
			expect(first).not.toBeNull();
			const f = first as NonNullable<typeof first>;
			const s = second as NonNullable<typeof second>;
			expect(s.currentPeriodStart.getTime()).toBe(f.currentPeriodEnd.getTime());
			expect(s.currentPeriodEnd.getTime()).toBeGreaterThan(
				f.currentPeriodEnd.getTime(),
			);
		});

		it("renew updates updatedAt", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await new Promise((r) => setTimeout(r, 5));

			const renewed = await ctrl.renewSubscription(sub.id);
			expect(renewed?.updatedAt.getTime()).toBeGreaterThan(
				sub.updatedAt.getTime(),
			);
		});
	});

	// ── expireSubscriptions edge cases ───────────────────────────────

	describe("expireSubscriptions edge cases", () => {
		it("expires multiple past-due subscriptions at once", async () => {
			const plan = await ctrl.createPlan(planParams({ interval: "day" }));

			const subs: Awaited<ReturnType<typeof ctrl.subscribe>>[] = [];
			for (let i = 0; i < 3; i++) {
				subs.push(
					await ctrl.subscribe({
						planId: plan.id,
						email: `user${i}@example.com`,
					}),
				);
			}

			// Backdate all three
			const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
			for (const sub of subs) {
				await mockData.upsert("subscription", sub.id, {
					...sub,
					currentPeriodEnd: pastDate,
				} as Record<string, unknown>);
			}

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(3);
		});

		it("only expires active and trialing, not past_due", async () => {
			const plan = await ctrl.createPlan(planParams({ interval: "day" }));
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Manually set status to past_due with expired period
			const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
			await mockData.upsert("subscription", sub.id, {
				...sub,
				status: "past_due",
				currentPeriodEnd: pastDate,
			} as Record<string, unknown>);

			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(0);
		});

		it("does not expire subscriptions ending exactly now", async () => {
			const plan = await ctrl.createPlan(planParams({ interval: "month" }));
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			// Period end is in the future, so should not expire
			const count = await ctrl.expireSubscriptions();
			expect(count).toBe(0);

			const fetched = await ctrl.getSubscription(sub.id);
			expect(fetched?.status).toBe("active");
		});
	});

	// ── listSubscriptions edge cases ─────────────────────────────────

	describe("listSubscriptions edge cases", () => {
		it("combines email + status filters", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub1 = await ctrl.subscribe({
				planId: plan.id,
				email: "target@example.com",
			});
			await ctrl.subscribe({
				planId: plan.id,
				email: "target@example.com",
			});
			await ctrl.subscribe({
				planId: plan.id,
				email: "other@example.com",
			});

			// Cancel one of target's subscriptions
			await ctrl.cancelSubscription({ id: sub1.id });

			const results = await ctrl.listSubscriptions({
				email: "target@example.com",
				status: "active",
			});
			expect(results).toHaveLength(1);
			expect(results[0].status).toBe("active");
		});

		it("combines planId + status filters", async () => {
			const planA = await ctrl.createPlan(planParams({ name: "A" }));
			const planB = await ctrl.createPlan(planParams({ name: "B" }));

			const subA = await ctrl.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			await ctrl.subscribe({
				planId: planB.id,
				email: "user@example.com",
			});
			await ctrl.cancelSubscription({ id: subA.id });

			const results = await ctrl.listSubscriptions({
				planId: planA.id,
				status: "cancelled",
			});
			expect(results).toHaveLength(1);
			expect(results[0].planId).toBe(planA.id);
			expect(results[0].status).toBe("cancelled");
		});

		it("returns empty when all filters combined match nothing", async () => {
			const plan = await ctrl.createPlan(planParams());
			await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const results = await ctrl.listSubscriptions({
				email: "nobody@example.com",
				planId: plan.id,
				status: "cancelled",
			});
			expect(results).toHaveLength(0);
		});

		it("skip beyond total returns empty", async () => {
			const plan = await ctrl.createPlan(planParams());
			await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const results = await ctrl.listSubscriptions({ skip: 100 });
			expect(results).toHaveLength(0);
		});

		it("take=1 returns only one subscription", async () => {
			const plan = await ctrl.createPlan(planParams());
			await ctrl.subscribe({
				planId: plan.id,
				email: "a@example.com",
			});
			await ctrl.subscribe({
				planId: plan.id,
				email: "b@example.com",
			});

			const results = await ctrl.listSubscriptions({ take: 1 });
			expect(results).toHaveLength(1);
		});
	});

	// ── getSubscriptionByEmail edge cases ────────────────────────────

	describe("getSubscriptionByEmail edge cases", () => {
		it("returns first match when multiple subscriptions for same email", async () => {
			const plan = await ctrl.createPlan(planParams());
			await ctrl.subscribe({
				planId: plan.id,
				email: "multi@example.com",
			});
			await ctrl.subscribe({
				planId: plan.id,
				email: "multi@example.com",
			});

			const result = await ctrl.getSubscriptionByEmail({
				email: "multi@example.com",
			});
			expect(result).not.toBeNull();
			expect(result?.email).toBe("multi@example.com");
		});

		it("returns null when email exists but planId filter excludes it", async () => {
			const plan = await ctrl.createPlan(planParams());
			await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const result = await ctrl.getSubscriptionByEmail({
				email: "user@example.com",
				planId: "nonexistent-plan",
			});
			expect(result).toBeNull();
		});
	});

	// ── Event emission edge cases ────────────────────────────────────

	describe("event emission edge cases", () => {
		it("subscription.created includes interval and currency from plan", async () => {
			const events = createMockEvents();
			const ctrl = createSubscriptionController(mockData, events);

			const plan = await ctrl.createPlan(
				planParams({ interval: "year", currency: "EUR" }),
			);
			await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});

			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.interval).toBe("year");
			expect(payload.currency).toBe("EUR");
		});

		it("subscription.created includes trialing status for trial plans", async () => {
			const events = createMockEvents();
			const ctrl = createSubscriptionController(mockData, events);

			const plan = await ctrl.createPlan(
				planParams({ trialDays: 30, interval: "month" }),
			);
			await ctrl.subscribe({
				planId: plan.id,
				email: "trial@example.com",
			});

			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.status).toBe("trialing");
		});

		it("subscription.renewed includes plan name", async () => {
			const events = createMockEvents();
			const ctrl = createSubscriptionController(mockData, events);

			const plan = await ctrl.createPlan(
				planParams({ name: "Gold Plan", interval: "month" }),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "renew@example.com",
			});
			events.emitted.length = 0;

			await ctrl.renewSubscription(sub.id);

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].type).toBe("subscription.renewed");
			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.planName).toBe("Gold Plan");
		});

		it("subscription.cancelled includes customerId when present", async () => {
			const events = createMockEvents();
			const ctrl = createSubscriptionController(mockData, events);

			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
				customerId: "cust_42",
			});
			events.emitted.length = 0;

			await ctrl.cancelSubscription({ id: sub.id });

			const payload = events.emitted[0].payload as Record<string, unknown>;
			expect(payload.customerId).toBe("cust_42");
			expect(payload.planId).toBe(plan.id);
		});

		it("renew does not emit when plan is deleted", async () => {
			const events = createMockEvents();
			const ctrl = createSubscriptionController(mockData, events);

			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			events.emitted.length = 0;

			await ctrl.deletePlan(plan.id);
			const result = await ctrl.renewSubscription(sub.id);

			expect(result).toBeNull();
			expect(events.emitted).toHaveLength(0);
		});
	});

	// ── Data integrity ───────────────────────────────────────────────

	describe("data integrity", () => {
		it("subscription persists and retrieves correctly", async () => {
			const plan = await ctrl.createPlan(
				planParams({
					name: "Persistence Test",
					currency: "JPY",
					interval: "year",
					intervalCount: 1,
				}),
			);
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "persist@example.com",
				customerId: "cust_99",
			});

			const fetched = await ctrl.getSubscription(sub.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.planId).toBe(plan.id);
			expect(fetched?.email).toBe("persist@example.com");
			expect(fetched?.customerId).toBe("cust_99");
			expect(fetched?.status).toBe("active");
			expect(fetched?.cancelAtPeriodEnd).toBe(false);
		});

		it("plan update persists and is fetchable", async () => {
			const plan = await ctrl.createPlan(
				planParams({ name: "Original", price: 100 }),
			);
			await ctrl.updatePlan(plan.id, { name: "Updated", price: 200 });

			const fetched = await ctrl.getPlan(plan.id);
			expect(fetched?.name).toBe("Updated");
			expect(fetched?.price).toBe(200);
		});

		it("cancelled subscription is retrievable with updated state", async () => {
			const plan = await ctrl.createPlan(planParams());
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await ctrl.cancelSubscription({ id: sub.id });

			const fetched = await ctrl.getSubscription(sub.id);
			expect(fetched?.status).toBe("cancelled");
			expect(fetched?.cancelledAt).toBeInstanceOf(Date);
		});

		it("renewed subscription period dates are persisted", async () => {
			const plan = await ctrl.createPlan(planParams({ interval: "week" }));
			const sub = await ctrl.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const renewed = await ctrl.renewSubscription(sub.id);

			const fetched = await ctrl.getSubscription(sub.id);
			expect(fetched?.currentPeriodStart.getTime()).toBe(
				renewed?.currentPeriodStart.getTime(),
			);
			expect(fetched?.currentPeriodEnd.getTime()).toBe(
				renewed?.currentPeriodEnd.getTime(),
			);
		});
	});
});
