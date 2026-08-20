import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSubscriptionController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the subscriptions module.
 *
 * Covers: plan CRUD, subscription lifecycle (subscribe, cancel, renew, expire),
 * trial handling, listing/filtering, duplicate prevention, and edge cases.
 */

describe("subscriptions — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSubscriptionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSubscriptionController(mockData);
	});

	// ── Plan CRUD ─────────────────────────────────────────────────

	describe("plan creation", () => {
		it("creates a monthly plan with defaults", async () => {
			const plan = await controller.createPlan({
				name: "Basic Monthly",
				price: 999,
				interval: "month",
			});
			expect(plan.id).toBeDefined();
			expect(plan.name).toBe("Basic Monthly");
			expect(plan.price).toBe(999);
			expect(plan.interval).toBe("month");
			expect(plan.intervalCount).toBe(1);
			expect(plan.currency).toBe("USD");
			expect(plan.isActive).toBe(true);
		});

		it("creates a yearly plan with trial", async () => {
			const plan = await controller.createPlan({
				name: "Premium Annual",
				price: 9999,
				interval: "year",
				trialDays: 14,
			});
			expect(plan.interval).toBe("year");
			expect(plan.trialDays).toBe(14);
		});

		it("creates a weekly plan with custom interval count", async () => {
			const plan = await controller.createPlan({
				name: "Bi-weekly",
				price: 499,
				interval: "week",
				intervalCount: 2,
			});
			expect(plan.intervalCount).toBe(2);
		});

		it("creates a daily plan", async () => {
			const plan = await controller.createPlan({
				name: "Daily access",
				price: 99,
				interval: "day",
			});
			expect(plan.interval).toBe("day");
		});

		it("creates plan with custom currency", async () => {
			const plan = await controller.createPlan({
				name: "Euro Plan",
				price: 1999,
				interval: "month",
				currency: "EUR",
			});
			expect(plan.currency).toBe("EUR");
		});

		it("creates an inactive plan", async () => {
			const plan = await controller.createPlan({
				name: "Draft Plan",
				price: 4999,
				interval: "month",
				isActive: false,
			});
			expect(plan.isActive).toBe(false);
		});

		it("creates plan with description", async () => {
			const plan = await controller.createPlan({
				name: "Pro",
				description: "For power users",
				price: 2999,
				interval: "month",
			});
			expect(plan.description).toBe("For power users");
		});
	});

	describe("plan retrieval and listing", () => {
		it("gets plan by id", async () => {
			const plan = await controller.createPlan({
				name: "Test",
				price: 999,
				interval: "month",
			});
			const found = await controller.getPlan(plan.id);
			expect(found?.name).toBe("Test");
		});

		it("getPlan returns null for unknown id", async () => {
			const result = await controller.getPlan("fake-id");
			expect(result).toBeNull();
		});

		it("lists all plans", async () => {
			await controller.createPlan({
				name: "Plan A",
				price: 999,
				interval: "month",
			});
			await controller.createPlan({
				name: "Plan B",
				price: 1999,
				interval: "year",
			});
			const plans = await controller.listPlans({});
			expect(plans).toHaveLength(2);
		});

		it("lists active-only plans", async () => {
			await controller.createPlan({
				name: "Active",
				price: 999,
				interval: "month",
			});
			await controller.createPlan({
				name: "Inactive",
				price: 999,
				interval: "month",
				isActive: false,
			});
			const active = await controller.listPlans({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("paginates plans", async () => {
			for (let i = 0; i < 8; i++) {
				await controller.createPlan({
					name: `Plan ${i}`,
					price: 999,
					interval: "month",
				});
			}
			const page = await controller.listPlans({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});
	});

	describe("plan update", () => {
		it("updates plan name", async () => {
			const plan = await controller.createPlan({
				name: "Old Name",
				price: 999,
				interval: "month",
			});
			const updated = await controller.updatePlan(plan.id, {
				name: "New Name",
			});
			expect(updated?.name).toBe("New Name");
		});

		it("updates plan price", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const updated = await controller.updatePlan(plan.id, { price: 1999 });
			expect(updated?.price).toBe(1999);
		});

		it("updates trial days", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const updated = await controller.updatePlan(plan.id, { trialDays: 30 });
			expect(updated?.trialDays).toBe(30);
		});

		it("deactivates a plan", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const updated = await controller.updatePlan(plan.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("updatePlan returns null for unknown id", async () => {
			const result = await controller.updatePlan("fake-id", { name: "X" });
			expect(result).toBeNull();
		});
	});

	describe("plan deletion", () => {
		it("deletes a plan", async () => {
			const plan = await controller.createPlan({
				name: "To delete",
				price: 999,
				interval: "month",
			});
			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);
			const found = await controller.getPlan(plan.id);
			expect(found).toBeNull();
		});

		it("deletePlan always returns true (fire-and-forget)", async () => {
			const result = await controller.deletePlan("fake-id");
			expect(result).toBe(true);
		});
	});

	// ── Subscription lifecycle ────────────────────────────────────

	describe("subscribe", () => {
		it("creates a new subscription", async () => {
			const plan = await controller.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			expect(sub.id).toBeDefined();
			expect(sub.planId).toBe(plan.id);
			expect(sub.email).toBe("user@example.com");
			expect(sub.status).toBe("active");
		});

		it("creates subscription with customerId", async () => {
			const plan = await controller.createPlan({
				name: "Monthly",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
				customerId: "cust_1",
			});
			expect(sub.customerId).toBe("cust_1");
		});

		it("subscription starts trialing when plan has trial", async () => {
			const plan = await controller.createPlan({
				name: "Trial Plan",
				price: 999,
				interval: "month",
				trialDays: 14,
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			expect(sub.status).toBe("trialing");
		});
	});

	describe("subscription retrieval", () => {
		it("getSubscription returns subscription by id", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const found = await controller.getSubscription(sub.id);
			expect(found?.email).toBe("user@example.com");
		});

		it("getSubscription returns null for unknown id", async () => {
			const result = await controller.getSubscription("fake-id");
			expect(result).toBeNull();
		});

		it("getSubscriptionByEmail finds active subscription", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const found = await controller.getSubscriptionByEmail({
				email: "user@example.com",
			});
			expect(found?.planId).toBe(plan.id);
		});

		it("getSubscriptionByEmail returns null for non-subscriber", async () => {
			const result = await controller.getSubscriptionByEmail({
				email: "nobody@example.com",
			});
			expect(result).toBeNull();
		});

		it("getSubscriptionByEmail filters by planId", async () => {
			const planA = await controller.createPlan({
				name: "Plan A",
				price: 999,
				interval: "month",
			});
			const planB = await controller.createPlan({
				name: "Plan B",
				price: 1999,
				interval: "month",
			});
			await controller.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			await controller.subscribe({
				planId: planB.id,
				email: "user@example.com",
			});

			const found = await controller.getSubscriptionByEmail({
				email: "user@example.com",
				planId: planB.id,
			});
			expect(found?.planId).toBe(planB.id);
		});
	});

	describe("cancel subscription", () => {
		it("cancels immediately by default", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const cancelled = await controller.cancelSubscription({ id: sub.id });
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels at period end", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			const cancelled = await controller.cancelSubscription({
				id: sub.id,
				cancelAtPeriodEnd: true,
			});
			expect(cancelled?.cancelAtPeriodEnd).toBe(true);
		});

		it("cancelSubscription returns null for unknown id", async () => {
			const result = await controller.cancelSubscription({ id: "fake-id" });
			expect(result).toBeNull();
		});
	});

	describe("renew subscription", () => {
		it("renews a cancelled subscription", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const sub = await controller.subscribe({
				planId: plan.id,
				email: "user@example.com",
			});
			await controller.cancelSubscription({ id: sub.id });
			const renewed = await controller.renewSubscription(sub.id);
			expect(renewed?.status).toBe("active");
		});

		it("renewSubscription returns null for unknown id", async () => {
			const result = await controller.renewSubscription("fake-id");
			expect(result).toBeNull();
		});
	});

	describe("expire subscriptions", () => {
		it("returns 0 when no subscriptions are expired", async () => {
			const count = await controller.expireSubscriptions();
			expect(count).toBe(0);
		});
	});

	// ── Listing and filtering ─────────────────────────────────────

	describe("subscription listing", () => {
		it("lists all subscriptions", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "a@example.com",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "b@example.com",
			});
			const subs = await controller.listSubscriptions({});
			expect(subs).toHaveLength(2);
		});

		it("filters by email", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "target@example.com",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "other@example.com",
			});
			const subs = await controller.listSubscriptions({
				email: "target@example.com",
			});
			expect(subs).toHaveLength(1);
			expect(subs[0].email).toBe("target@example.com");
		});

		it("filters by planId", async () => {
			const planA = await controller.createPlan({
				name: "A",
				price: 999,
				interval: "month",
			});
			const planB = await controller.createPlan({
				name: "B",
				price: 1999,
				interval: "year",
			});
			await controller.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			await controller.subscribe({
				planId: planB.id,
				email: "user2@example.com",
			});
			const subs = await controller.listSubscriptions({ planId: planA.id });
			expect(subs).toHaveLength(1);
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			const sub1 = await controller.subscribe({
				planId: plan.id,
				email: "a@example.com",
			});
			await controller.subscribe({
				planId: plan.id,
				email: "b@example.com",
			});
			await controller.cancelSubscription({ id: sub1.id });

			const active = await controller.listSubscriptions({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].email).toBe("b@example.com");
		});

		it("paginates subscriptions", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				price: 999,
				interval: "month",
			});
			for (let i = 0; i < 10; i++) {
				await controller.subscribe({
					planId: plan.id,
					email: `user${i}@example.com`,
				});
			}
			const page = await controller.listSubscriptions({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});
	});

	// ── Multi-plan isolation ──────────────────────────────────────

	describe("multi-plan isolation", () => {
		it("same email can subscribe to different plans", async () => {
			const planA = await controller.createPlan({
				name: "A",
				price: 999,
				interval: "month",
			});
			const planB = await controller.createPlan({
				name: "B",
				price: 1999,
				interval: "month",
			});
			const sub1 = await controller.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			const sub2 = await controller.subscribe({
				planId: planB.id,
				email: "user@example.com",
			});
			expect(sub1.id).not.toBe(sub2.id);
			expect(sub1.planId).toBe(planA.id);
			expect(sub2.planId).toBe(planB.id);
		});

		it("cancelling one plan does not affect another", async () => {
			const planA = await controller.createPlan({
				name: "A",
				price: 999,
				interval: "month",
			});
			const planB = await controller.createPlan({
				name: "B",
				price: 1999,
				interval: "month",
			});
			const sub1 = await controller.subscribe({
				planId: planA.id,
				email: "user@example.com",
			});
			await controller.subscribe({
				planId: planB.id,
				email: "user@example.com",
			});
			await controller.cancelSubscription({ id: sub1.id });

			const found = await controller.getSubscriptionByEmail({
				email: "user@example.com",
				planId: planB.id,
			});
			expect(found?.status).toBe("active");
		});
	});
});
