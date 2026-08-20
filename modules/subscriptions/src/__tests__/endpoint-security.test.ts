import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { SubscriptionController } from "../service";
import { createSubscriptionController } from "../service-impl";
import { storeSearch } from "../store/endpoints/store-search";

/**
 * Security regression tests for subscriptions endpoints.
 *
 * Subscriptions hold recurring billing data tied to customer emails.
 * These tests verify:
 * - Customer subscription isolation: one email cannot see another's subscriptions
 * - Plan integrity: inactive/deleted plans cannot be subscribed to
 * - Billing cycle enforcement: period dates are correctly computed per interval
 * - Cancellation rules: immediate vs. end-of-period cancellation semantics
 * - Renewal validation: renewal fails gracefully when plan is deleted
 * - Expiration guard: only active/trialing subs with past-due periods expire
 */

describe("subscriptions endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: SubscriptionController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSubscriptionController(mockData);
	});

	describe("store endpoint input hardening", () => {
		it("sanitizes search text and coerces numeric limits", () => {
			const parsed = storeSearch.options.query.parse({
				q: "  <b>subscriptions</b><script>alert(1)</script>  ",
				limit: "10",
			});

			expect(parsed.q).toBe("subscriptions");
			expect(parsed.limit).toBe(10);
		});

		it("rejects oversized store-search limits", () => {
			expect(
				storeSearch.options.query.safeParse({
					q: "subscriptions",
					limit: "99",
				}).success,
			).toBe(false);
		});
	});

	// ── Customer Subscription Isolation ─────────────────────────────

	describe("customer subscription isolation", () => {
		it("listSubscriptions by email only returns that email's subscriptions", async () => {
			const plan = await controller.createPlan({
				name: "Pro",
				price: 1999,
				interval: "month",
			});
			await controller.subscribe({ planId: plan.id, email: "alice@test.com" });
			await controller.subscribe({ planId: plan.id, email: "alice@test.com" });
			await controller.subscribe({ planId: plan.id, email: "bob@test.com" });

			const aliceSubs = await controller.listSubscriptions({
				email: "alice@test.com",
			});
			expect(aliceSubs).toHaveLength(2);
			for (const sub of aliceSubs) {
				expect(sub.email).toBe("alice@test.com");
			}

			const bobSubs = await controller.listSubscriptions({
				email: "bob@test.com",
			});
			expect(bobSubs).toHaveLength(1);
			expect(bobSubs[0].email).toBe("bob@test.com");
		});

		it("getSubscriptionByEmail does not return another email's subscription", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				price: 499,
				interval: "month",
			});
			await controller.subscribe({ planId: plan.id, email: "victim@test.com" });

			const result = await controller.getSubscriptionByEmail({
				email: "attacker@test.com",
			});
			expect(result).toBeNull();
		});

		it("getSubscription exposes subscription regardless of email (endpoint must check ownership)", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				price: 499,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "victim@test.com",
				customerId: "cust_victim",
			});

			// The controller's getSubscription does NOT check ownership —
			// endpoints MUST verify email or customerId matches the session user
			const result = await controller.getSubscription(sub.id);
			expect(result).not.toBeNull();
			expect(result?.email).toBe("victim@test.com");
		});

		it("listSubscriptions by customerId-bearing email isolates across plans", async () => {
			const planA = await controller.createPlan({
				name: "Plan A",
				price: 999,
				interval: "month",
			});
			const planB = await controller.createPlan({
				name: "Plan B",
				price: 1999,
				interval: "year",
			});
			await controller.subscribe({
				planId: planA.id,
				email: "user@test.com",
				customerId: "cust_1",
			});
			await controller.subscribe({
				planId: planB.id,
				email: "other@test.com",
				customerId: "cust_2",
			});

			const filtered = await controller.listSubscriptions({
				email: "user@test.com",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].planId).toBe(planA.id);
		});
	});

	// ── Plan Integrity ──────────────────────────────────────────────

	describe("plan integrity", () => {
		it("rejects subscription to an inactive plan", async () => {
			const plan = await controller.createPlan({
				name: "Disabled",
				price: 500,
				interval: "month",
				isActive: false,
			});

			await expect(
				controller.subscribe({ planId: plan.id, email: "user@test.com" }),
			).rejects.toThrow("Plan is not active");
		});

		it("rejects subscription to a nonexistent plan", async () => {
			await expect(
				controller.subscribe({
					planId: "plan_does_not_exist",
					email: "user@test.com",
				}),
			).rejects.toThrow("Plan not found");
		});

		it("rejects subscription after plan is deactivated via update", async () => {
			const plan = await controller.createPlan({
				name: "Soon Disabled",
				price: 1000,
				interval: "month",
			});
			await controller.updatePlan(plan.id, { isActive: false });

			await expect(
				controller.subscribe({ planId: plan.id, email: "user@test.com" }),
			).rejects.toThrow("Plan is not active");
		});

		it("rejects subscription after plan is deleted", async () => {
			const plan = await controller.createPlan({
				name: "Temporary",
				price: 500,
				interval: "month",
			});
			await controller.deletePlan(plan.id);

			await expect(
				controller.subscribe({ planId: plan.id, email: "user@test.com" }),
			).rejects.toThrow("Plan not found");
		});

		it("plan update does not change immutable fields (currency, interval, intervalCount)", async () => {
			const plan = await controller.createPlan({
				name: "Stable",
				price: 999,
				currency: "EUR",
				interval: "year",
				intervalCount: 1,
			});

			const updated = await controller.updatePlan(plan.id, {
				name: "Renamed",
				price: 1999,
			});

			expect(updated?.currency).toBe("EUR");
			expect(updated?.interval).toBe("year");
			expect(updated?.intervalCount).toBe(1);
		});
	});

	// ── Billing Cycle Enforcement ───────────────────────────────────

	describe("billing cycle enforcement", () => {
		it("monthly subscription period spans roughly 30 days", async () => {
			const plan = await controller.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const diffMs =
				sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			// A month is 28-31 days
			expect(diffDays).toBeGreaterThanOrEqual(28);
			expect(diffDays).toBeLessThanOrEqual(31);
		});

		it("weekly subscription period spans 7 days", async () => {
			const plan = await controller.createPlan({
				name: "Weekly",
				price: 199,
				interval: "week",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const diffMs =
				sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});

		it("yearly subscription period spans roughly 365 days", async () => {
			const plan = await controller.createPlan({
				name: "Annual",
				price: 9999,
				interval: "year",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const diffMs =
				sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeGreaterThanOrEqual(365);
			expect(diffDays).toBeLessThanOrEqual(366);
		});

		it("custom intervalCount multiplies the period correctly", async () => {
			const plan = await controller.createPlan({
				name: "Bi-Weekly",
				price: 399,
				interval: "week",
				intervalCount: 2,
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const diffMs =
				sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(14, 0);
		});

		it("trial plan starts in trialing status with correct trial window", async () => {
			const plan = await controller.createPlan({
				name: "Trial Plan",
				price: 999,
				interval: "month",
				trialDays: 14,
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			expect(sub.status).toBe("trialing");
			expect(sub.trialStart).toBeInstanceOf(Date);
			expect(sub.trialEnd).toBeInstanceOf(Date);

			const trialMs =
				(sub.trialEnd as Date).getTime() - (sub.trialStart as Date).getTime();
			const trialDays = trialMs / (1000 * 60 * 60 * 24);
			expect(trialDays).toBeCloseTo(14, 0);
		});
	});

	// ── Cancellation Rules ──────────────────────────────────────────

	describe("cancellation rules", () => {
		it("immediate cancellation sets status to cancelled with timestamp", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 500,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const cancelled = await controller.cancelSubscription({ id: sub.id });

			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled?.cancelAtPeriodEnd).toBe(false);
		});

		it("cancel-at-period-end preserves active status without cancelledAt", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 500,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const result = await controller.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});

			expect(result?.status).toBe("active");
			expect(result?.cancelAtPeriodEnd).toBe(true);
			expect(result?.cancelledAt).toBeUndefined();
		});

		it("cancelling nonexistent subscription returns null", async () => {
			const result = await controller.cancelSubscription({
				id: "no_such_sub",
			});
			expect(result).toBeNull();
		});

		it("cancelled subscription can still be retrieved by id", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 500,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});
			await controller.cancelSubscription({ id: sub.id });

			const fetched = await controller.getSubscription(sub.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.status).toBe("cancelled");
		});
	});

	// ── Renewal Validation ──────────────────────────────────────────

	describe("renewal validation", () => {
		it("renewal advances period from previous end date", async () => {
			const plan = await controller.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const originalEnd = sub.currentPeriodEnd;
			const renewed = await controller.renewSubscription(sub.id);

			expect(renewed?.currentPeriodStart.getTime()).toBe(originalEnd.getTime());
			expect(renewed?.currentPeriodEnd.getTime()).toBeGreaterThan(
				originalEnd.getTime(),
			);
		});

		it("renewal resets status to active and clears cancelAtPeriodEnd", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 500,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});
			await controller.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});

			const renewed = await controller.renewSubscription(sub.id);

			expect(renewed?.status).toBe("active");
			expect(renewed?.cancelAtPeriodEnd).toBe(false);
		});

		it("renewal fails gracefully when plan has been deleted", async () => {
			const plan = await controller.createPlan({
				name: "Ephemeral",
				price: 500,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});
			await controller.deletePlan(plan.id);

			const result = await controller.renewSubscription(sub.id);
			expect(result).toBeNull();
		});

		it("renewal of nonexistent subscription returns null", async () => {
			const result = await controller.renewSubscription("no_such_sub");
			expect(result).toBeNull();
		});
	});

	// ── Expiration Guard ────────────────────────────────────────────

	describe("expiration guard", () => {
		it("expires active subscriptions with past-due period end", async () => {
			const plan = await controller.createPlan({
				name: "Daily",
				price: 99,
				interval: "day",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			// Backdate period end to 2 days ago
			const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
			await mockData.upsert("subscription", sub.id, {
				...(sub as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await controller.expireSubscriptions();
			expect(count).toBe(1);

			const expired = await controller.getSubscription(sub.id);
			expect(expired?.status).toBe("expired");
		});

		it("does not expire subscriptions with future period end", async () => {
			const plan = await controller.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});

			const count = await controller.expireSubscriptions();
			expect(count).toBe(0);
		});

		it("does not expire already cancelled subscriptions", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 500,
				interval: "day",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@test.com",
			});
			await controller.cancelSubscription({ id: sub.id });

			// Backdate period end
			const cancelled = await controller.getSubscription(sub.id);
			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await mockData.upsert("subscription", sub.id, {
				...(cancelled as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await controller.expireSubscriptions();
			expect(count).toBe(0);
		});

		it("expires trialing subscriptions with past-due period end", async () => {
			const plan = await controller.createPlan({
				name: "Trial Plan",
				price: 999,
				interval: "month",
				trialDays: 7,
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "trial@test.com",
			});
			expect(sub.status).toBe("trialing");

			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await mockData.upsert("subscription", sub.id, {
				...(sub as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await controller.expireSubscriptions();
			expect(count).toBe(1);

			const expired = await controller.getSubscription(sub.id);
			expect(expired?.status).toBe("expired");
		});

		it("expiration only affects past-due subs, leaving current ones intact", async () => {
			const plan = await controller.createPlan({
				name: "Daily",
				price: 99,
				interval: "day",
			});
			const expiringSub = await controller.subscribe({
				planId: plan.id,
				email: "expiring@test.com",
			});
			const currentSub = await controller.subscribe({
				planId: plan.id,
				email: "current@test.com",
			});

			// Only backdate one subscription
			const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
			await mockData.upsert("subscription", expiringSub.id, {
				...(expiringSub as unknown as Record<string, unknown>),
				currentPeriodEnd: pastDate,
			});

			const count = await controller.expireSubscriptions();
			expect(count).toBe(1);

			const stillActive = await controller.getSubscription(currentSub.id);
			expect(stillActive?.status).toBe("active");

			const nowExpired = await controller.getSubscription(expiringSub.id);
			expect(nowExpired?.status).toBe("expired");
		});
	});
});
