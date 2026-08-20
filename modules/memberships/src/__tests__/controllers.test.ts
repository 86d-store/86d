import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMembershipController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("membership controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMembershipController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMembershipController(mockData);
	});

	function createTestPlan(
		overrides: Partial<Parameters<typeof controller.createPlan>[0]> = {},
	) {
		return controller.createPlan({
			name: "Gold Plan",
			slug: "gold",
			price: 29.99,
			billingInterval: "monthly",
			...overrides,
		});
	}

	// ── Subscribe — trial vs active ─────────────────────────────────

	describe("subscribe — trial vs active status and dates", () => {
		it("monthly plan without trial sets status to active with endDate ~30 days out", async () => {
			const plan = await createTestPlan({
				slug: "monthly-no-trial",
				billingInterval: "monthly",
				trialDays: 0,
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			expect(m.status).toBe("active");
			expect(m.trialEndDate).toBeUndefined();
			expect(m.endDate).toBeInstanceOf(Date);

			const diffDays =
				((m.endDate as Date).getTime() - m.startDate.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeGreaterThanOrEqual(28);
			expect(diffDays).toBeLessThanOrEqual(31);
		});

		it("plan with trial sets status to trial and populates trialEndDate", async () => {
			const plan = await createTestPlan({
				slug: "trial-plan",
				billingInterval: "monthly",
				trialDays: 7,
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			expect(m.status).toBe("trial");
			expect(m.trialEndDate).toBeInstanceOf(Date);

			const trialDiff =
				((m.trialEndDate as Date).getTime() - m.startDate.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(trialDiff).toBeCloseTo(7, 0);

			// endDate should still be set (monthly billing)
			expect(m.endDate).toBeInstanceOf(Date);
		});

		it("yearly plan sets endDate ~365 days out", async () => {
			const plan = await createTestPlan({
				slug: "yearly",
				billingInterval: "yearly",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			expect(m.endDate).toBeInstanceOf(Date);
			const diffDays =
				((m.endDate as Date).getTime() - m.startDate.getTime()) /
				(1000 * 60 * 60 * 24);
			expect(diffDays).toBeGreaterThanOrEqual(364);
			expect(diffDays).toBeLessThanOrEqual(367);
		});

		it("lifetime plan has no endDate", async () => {
			const plan = await createTestPlan({
				slug: "lifetime",
				billingInterval: "lifetime",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			expect(m.status).toBe("active");
			expect(m.endDate).toBeUndefined();
		});

		it("lifetime plan with trial sets trial status but no endDate", async () => {
			const plan = await createTestPlan({
				slug: "lifetime-trial",
				billingInterval: "lifetime",
				trialDays: 14,
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			expect(m.status).toBe("trial");
			expect(m.trialEndDate).toBeInstanceOf(Date);
			expect(m.endDate).toBeUndefined();
		});
	});

	// ── Subscribe — cancels existing membership ─────────────────────

	describe("subscribe — cancels existing active/trial membership", () => {
		it("subscribing to a new plan cancels the previous active membership", async () => {
			const plan1 = await createTestPlan({ slug: "plan-a" });
			const plan2 = await createTestPlan({ slug: "plan-b" });

			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});
			expect(m1.status).toBe("active");

			const m2 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});
			expect(m2.status).toBe("active");

			const old = unwrap(await controller.getMembership(m1.id));
			expect(old.status).toBe("cancelled");
			expect(old.cancelledAt).toBeInstanceOf(Date);
		});

		it("subscribing cancels an existing trial membership", async () => {
			const trialPlan = await createTestPlan({
				slug: "trial-first",
				trialDays: 14,
			});
			const plan2 = await createTestPlan({ slug: "paid" });

			const trial = await controller.subscribe({
				customerId: "cust_1",
				planId: trialPlan.id,
			});
			expect(trial.status).toBe("trial");

			await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});

			const oldTrial = unwrap(await controller.getMembership(trial.id));
			expect(oldTrial.status).toBe("cancelled");
		});

		it("does not cancel a paused membership when subscribing", async () => {
			const plan1 = await createTestPlan({ slug: "p1" });
			const plan2 = await createTestPlan({ slug: "p2" });

			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});
			await controller.pauseMembership(m1.id);

			await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});

			const paused = unwrap(await controller.getMembership(m1.id));
			expect(paused.status).toBe("paused");
		});

		it("does not cancel already-cancelled memberships again", async () => {
			const plan1 = await createTestPlan({ slug: "p1" });
			const plan2 = await createTestPlan({ slug: "p2" });
			const plan3 = await createTestPlan({ slug: "p3" });

			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});
			await controller.cancelMembership(m1.id);

			const m2 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});

			// m1 should still be cancelled (not double-cancelled)
			const old = unwrap(await controller.getMembership(m1.id));
			expect(old.status).toBe("cancelled");

			// Now subscribe to plan3 should cancel m2
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan3.id,
			});

			const m2After = unwrap(await controller.getMembership(m2.id));
			expect(m2After.status).toBe("cancelled");
		});
	});

	// ── maxMembers enforcement ──────────────────────────────────────

	describe("maxMembers enforcement", () => {
		it("throws when active members reach maxMembers limit", async () => {
			const plan = await createTestPlan({
				slug: "limited",
				maxMembers: 2,
			});

			await controller.subscribe({ customerId: "cust_1", planId: plan.id });
			await controller.subscribe({ customerId: "cust_2", planId: plan.id });

			await expect(
				controller.subscribe({ customerId: "cust_3", planId: plan.id }),
			).rejects.toThrow("Plan has reached maximum members");
		});

		it("trial members count toward maxMembers", async () => {
			const plan = await createTestPlan({
				slug: "limited-trial",
				maxMembers: 1,
				trialDays: 7,
			});

			await controller.subscribe({ customerId: "cust_1", planId: plan.id });

			await expect(
				controller.subscribe({ customerId: "cust_2", planId: plan.id }),
			).rejects.toThrow("Plan has reached maximum members");
		});

		it("cancelled members do not count toward maxMembers", async () => {
			const plan = await createTestPlan({
				slug: "limited-cancel",
				maxMembers: 1,
			});

			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			// Slot should be free now
			const m2 = await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			expect(m2.status).toBe("active");
		});

		it("allows subscribe when maxMembers is not set (unlimited)", async () => {
			const plan = await createTestPlan({ slug: "unlimited" });

			for (let i = 0; i < 10; i++) {
				const m = await controller.subscribe({
					customerId: `cust_${i}`,
					planId: plan.id,
				});
				expect(m.status).toBe("active");
			}
		});
	});

	// ── Inactive plan throws on subscribe ───────────────────────────

	describe("inactive plan throws on subscribe", () => {
		it("throws Plan is not active for an inactive plan", async () => {
			const plan = await createTestPlan({
				slug: "disabled",
				isActive: false,
			});

			await expect(
				controller.subscribe({ customerId: "cust_1", planId: plan.id }),
			).rejects.toThrow("Plan is not active");
		});

		it("throws after deactivating a previously active plan", async () => {
			const plan = await createTestPlan({ slug: "to-deactivate" });

			// Subscribe while active — should work
			await controller.subscribe({ customerId: "cust_1", planId: plan.id });

			// Deactivate
			await controller.updatePlan(plan.id, { isActive: false });

			// New subscribe should fail
			await expect(
				controller.subscribe({ customerId: "cust_2", planId: plan.id }),
			).rejects.toThrow("Plan is not active");
		});
	});

	// ── Pause/resume lifecycle ──────────────────────────────────────

	describe("pause/resume lifecycle", () => {
		it("active -> pause -> resume -> active", async () => {
			const plan = await createTestPlan({ slug: "lifecycle" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(m.status).toBe("active");

			const paused = unwrap(await controller.pauseMembership(m.id));
			expect(paused.status).toBe("paused");
			expect(paused.pausedAt).toBeInstanceOf(Date);

			const resumed = unwrap(await controller.resumeMembership(m.id));
			expect(resumed.status).toBe("active");
		});

		it("trial membership can be paused", async () => {
			const plan = await createTestPlan({
				slug: "trial-pause",
				trialDays: 14,
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(m.status).toBe("trial");

			const paused = unwrap(await controller.pauseMembership(m.id));
			expect(paused.status).toBe("paused");
		});

		it("cancelled membership cannot be paused", async () => {
			const plan = await createTestPlan({ slug: "cancel-pause" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const result = unwrap(await controller.pauseMembership(m.id));
			expect(result.status).toBe("cancelled");
		});

		it("only paused membership can be resumed — active returns as-is", async () => {
			const plan = await createTestPlan({ slug: "resume-active" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const result = unwrap(await controller.resumeMembership(m.id));
			expect(result.status).toBe("active");
		});

		it("cancelled membership cannot be resumed", async () => {
			const plan = await createTestPlan({ slug: "resume-cancel" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const result = unwrap(await controller.resumeMembership(m.id));
			expect(result.status).toBe("cancelled");
		});

		it("pause and resume return null for non-existent membership", async () => {
			expect(await controller.pauseMembership("no-id")).toBeNull();
			expect(await controller.resumeMembership("no-id")).toBeNull();
		});
	});

	// ── deletePlan cascades ─────────────────────────────────────────

	describe("deletePlan cascades to benefits, products, and memberships", () => {
		it("deleting a plan removes all associated benefits, gated products, and memberships", async () => {
			const plan = await createTestPlan({ slug: "cascade-test" });

			// Add benefits
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "15",
			});

			// Gate products
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_2",
			});

			// Subscribe members
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});

			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);

			// Verify cascade
			expect(await controller.getPlan(plan.id)).toBeNull();
			expect(await controller.listBenefits(plan.id)).toHaveLength(0);
			expect(
				await controller.listGatedProducts({ planId: plan.id }),
			).toHaveLength(0);
			expect(
				await controller.listMemberships({ planId: plan.id }),
			).toHaveLength(0);
		});

		it("deleting one plan does not affect another plan's data", async () => {
			const planA = await createTestPlan({ slug: "plan-a" });
			const planB = await createTestPlan({ slug: "plan-b" });

			await controller.addBenefit({
				planId: planA.id,
				type: "free_shipping",
				value: "true",
			});
			await controller.addBenefit({
				planId: planB.id,
				type: "early_access",
				value: "true",
			});

			await controller.gateProduct({
				planId: planA.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: planB.id,
				productId: "prod_2",
			});

			await controller.subscribe({
				customerId: "cust_1",
				planId: planA.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: planB.id,
			});

			await controller.deletePlan(planA.id);

			// Plan B data should be intact
			expect(await controller.getPlan(planB.id)).not.toBeNull();
			expect(await controller.listBenefits(planB.id)).toHaveLength(1);
			expect(
				await controller.listGatedProducts({ planId: planB.id }),
			).toHaveLength(1);
			expect(
				await controller.listMemberships({ planId: planB.id }),
			).toHaveLength(1);
		});
	});

	// ── canAccessProduct ────────────────────────────────────────────

	describe("canAccessProduct — gating logic", () => {
		it("ungated product returns true for any customer", async () => {
			const result = await controller.canAccessProduct({
				customerId: "anyone",
				productId: "free-product",
			});
			expect(result).toBe(true);
		});

		it("gated product returns true for customer with active membership on qualifying plan", async () => {
			const plan = await createTestPlan({ slug: "access-plan" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "premium-item",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "premium-item",
			});
			expect(result).toBe(true);
		});

		it("gated product returns true for customer on trial membership", async () => {
			const plan = await createTestPlan({
				slug: "trial-access",
				trialDays: 14,
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "premium-item",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "premium-item",
			});
			expect(result).toBe(true);
		});

		it("gated product returns false for customer with no membership", async () => {
			const plan = await createTestPlan({ slug: "gate-no-member" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "locked-item",
			});

			const result = await controller.canAccessProduct({
				customerId: "no-membership-cust",
				productId: "locked-item",
			});
			expect(result).toBe(false);
		});

		it("gated product returns false for customer with membership on a different plan", async () => {
			const planA = await createTestPlan({ slug: "gate-plan-a" });
			const planB = await createTestPlan({ slug: "gate-plan-b" });

			await controller.gateProduct({
				planId: planA.id,
				productId: "exclusive-item",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: planB.id,
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "exclusive-item",
			});
			expect(result).toBe(false);
		});

		it("gated product returns false for cancelled member", async () => {
			const plan = await createTestPlan({ slug: "gate-cancel" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "premium-item",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "premium-item",
			});
			expect(result).toBe(false);
		});

		it("gated product returns false for paused member", async () => {
			const plan = await createTestPlan({ slug: "gate-pause" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "premium-item",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.pauseMembership(m.id);

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "premium-item",
			});
			expect(result).toBe(false);
		});
	});

	// ── gateProduct idempotency ─────────────────────────────────────

	describe("gateProduct idempotency", () => {
		it("calling gateProduct twice returns the same record", async () => {
			const plan = await createTestPlan({ slug: "idem" });

			const first = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_x",
			});
			const second = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_x",
			});

			expect(first.id).toBe(second.id);
			expect(first.planId).toBe(second.planId);
			expect(first.productId).toBe(second.productId);
		});

		it("gating different products on the same plan creates separate records", async () => {
			const plan = await createTestPlan({ slug: "multi-gate" });

			const g1 = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_a",
			});
			const g2 = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_b",
			});

			expect(g1.id).not.toBe(g2.id);

			const count = await controller.countGatedProducts(plan.id);
			expect(count).toBe(2);
		});

		it("gating the same product on different plans creates separate records", async () => {
			const planA = await createTestPlan({ slug: "gate-a" });
			const planB = await createTestPlan({ slug: "gate-b" });

			const g1 = await controller.gateProduct({
				planId: planA.id,
				productId: "shared-product",
			});
			const g2 = await controller.gateProduct({
				planId: planB.id,
				productId: "shared-product",
			});

			expect(g1.id).not.toBe(g2.id);
		});
	});

	// ── getCustomerBenefits — active/trial only ─────────────────────

	describe("getCustomerBenefits — only for active/trial members", () => {
		it("returns active benefits for a customer with active membership", async () => {
			const plan = await createTestPlan({ slug: "benefit-active" });
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "20",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(2);
		});

		it("returns active benefits for a customer on trial", async () => {
			const plan = await createTestPlan({
				slug: "benefit-trial",
				trialDays: 7,
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "early_access",
				value: "true",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(1);
			expect(benefits[0].type).toBe("early_access");
		});

		it("returns empty for a cancelled member", async () => {
			const plan = await createTestPlan({ slug: "benefit-cancel" });
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(0);
		});

		it("returns empty for a paused member", async () => {
			const plan = await createTestPlan({ slug: "benefit-pause" });
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.pauseMembership(m.id);

			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(0);
		});

		it("excludes inactive benefits", async () => {
			const plan = await createTestPlan({ slug: "benefit-inactive" });
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
				isActive: true,
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "10",
				isActive: false,
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(1);
			expect(benefits[0].type).toBe("free_shipping");
		});

		it("returns empty for a customer with no membership", async () => {
			const benefits = await controller.getCustomerBenefits("ghost");
			expect(benefits).toHaveLength(0);
		});
	});

	// ── Stats accuracy ──────────────────────────────────────────────

	describe("stats accuracy", () => {
		it("returns all zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalPlans).toBe(0);
			expect(stats.activePlans).toBe(0);
			expect(stats.totalMembers).toBe(0);
			expect(stats.activeMembers).toBe(0);
			expect(stats.trialMembers).toBe(0);
			expect(stats.cancelledMembers).toBe(0);
			expect(stats.gatedProducts).toBe(0);
		});

		it("counts plans, members, and gated products correctly", async () => {
			const activePlan = await createTestPlan({
				slug: "active-stats",
				isActive: true,
			});
			const trialPlan = await createTestPlan({
				slug: "trial-stats",
				isActive: true,
				trialDays: 14,
			});
			await createTestPlan({
				slug: "inactive-stats",
				isActive: false,
			});

			// 2 active members on activePlan
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: activePlan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: activePlan.id,
			});

			// 1 trial member on trialPlan
			await controller.subscribe({
				customerId: "cust_3",
				planId: trialPlan.id,
			});

			// Cancel one active member
			await controller.cancelMembership(m1.id);

			// Gate 2 products to activePlan, 1 to trialPlan (same productId = 2 unique)
			await controller.gateProduct({
				planId: activePlan.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: activePlan.id,
				productId: "prod_2",
			});
			await controller.gateProduct({
				planId: trialPlan.id,
				productId: "prod_1",
			});

			const stats = await controller.getStats();
			expect(stats.totalPlans).toBe(3);
			expect(stats.activePlans).toBe(2);
			expect(stats.totalMembers).toBe(3);
			expect(stats.activeMembers).toBe(1);
			expect(stats.trialMembers).toBe(1);
			expect(stats.cancelledMembers).toBe(1);
			expect(stats.gatedProducts).toBe(2); // unique productIds
		});

		it("gatedProducts counts unique productIds across plans", async () => {
			const planA = await createTestPlan({ slug: "stat-a" });
			const planB = await createTestPlan({ slug: "stat-b" });

			// Same product gated to both plans
			await controller.gateProduct({
				planId: planA.id,
				productId: "shared",
			});
			await controller.gateProduct({
				planId: planB.id,
				productId: "shared",
			});
			// Unique product
			await controller.gateProduct({
				planId: planA.id,
				productId: "unique",
			});

			const stats = await controller.getStats();
			expect(stats.gatedProducts).toBe(2); // "shared" + "unique"
		});

		it("paused members are not counted as active or trial", async () => {
			const plan = await createTestPlan({ slug: "stat-pause" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.pauseMembership(m.id);

			const stats = await controller.getStats();
			expect(stats.totalMembers).toBe(1);
			expect(stats.activeMembers).toBe(0);
			expect(stats.trialMembers).toBe(0);
			expect(stats.cancelledMembers).toBe(0);
		});
	});

	// ── getCustomerMembership — priority ordering ───────────────────

	describe("getCustomerMembership — priority ordering", () => {
		it("returns membership with attached plan", async () => {
			const plan = await createTestPlan({ slug: "cust-plan" });
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const result = unwrap(await controller.getCustomerMembership("cust_1"));
			expect(result.plan).toBeDefined();
			expect(result.plan.id).toBe(plan.id);
			expect(result.plan.name).toBe("Gold Plan");
		});

		it("returns null when all memberships are cancelled", async () => {
			const plan = await createTestPlan({ slug: "all-cancelled" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const result = await controller.getCustomerMembership("cust_1");
			expect(result).toBeNull();
		});

		it("returns null for customer who never subscribed", async () => {
			const result = await controller.getCustomerMembership("no-one");
			expect(result).toBeNull();
		});
	});

	// ── updatePlan null clearing ────────────────────────────────────

	describe("updatePlan — null clearing for optional fields", () => {
		it("clears description, features, and maxMembers when set to null", async () => {
			const plan = await createTestPlan({
				slug: "nullable",
				description: "Premium tier",
				features: ["Feature A", "Feature B"],
				maxMembers: 50,
			});

			const updated = unwrap(
				await controller.updatePlan(plan.id, {
					description: null,
					features: null,
					maxMembers: null,
				}),
			);

			expect(updated.description).toBeUndefined();
			expect(updated.features).toBeUndefined();
			expect(updated.maxMembers).toBeUndefined();
		});

		it("preserves optional fields when update does not mention them", async () => {
			const plan = await createTestPlan({
				slug: "preserve",
				description: "Keep me",
				features: ["A"],
				maxMembers: 100,
			});

			const updated = unwrap(
				await controller.updatePlan(plan.id, { name: "Renamed" }),
			);

			expect(updated.name).toBe("Renamed");
			expect(updated.description).toBe("Keep me");
			expect(updated.features).toEqual(["A"]);
			expect(updated.maxMembers).toBe(100);
		});
	});

	// ── ungateProduct edge cases ────────────────────────────────────

	describe("ungateProduct edge cases", () => {
		it("ungating restores product access for non-members", async () => {
			const plan = await createTestPlan({ slug: "ungate-test" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_x",
			});

			// Gated — non-member cannot access
			const before = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_x",
			});
			expect(before).toBe(false);

			// Ungate
			await controller.ungateProduct({
				planId: plan.id,
				productId: "prod_x",
			});

			// Now accessible
			const after = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_x",
			});
			expect(after).toBe(true);
		});

		it("ungating non-existent gating returns false", async () => {
			const plan = await createTestPlan({ slug: "ungate-miss" });
			const result = await controller.ungateProduct({
				planId: plan.id,
				productId: "never-gated",
			});
			expect(result).toBe(false);
		});
	});

	// ── Cancel already cancelled/expired ────────────────────────────

	describe("cancelMembership — idempotent for cancelled/expired", () => {
		it("returns cancelled membership as-is without updating", async () => {
			const plan = await createTestPlan({ slug: "cancel-idem" });
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const first = unwrap(await controller.cancelMembership(m.id));
			expect(first.status).toBe("cancelled");
			const firstCancelledAt = first.cancelledAt;

			const second = unwrap(await controller.cancelMembership(m.id));
			expect(second.status).toBe("cancelled");
			// cancelledAt should be the same — not re-set
			expect(second.cancelledAt?.getTime()).toBe(firstCancelledAt?.getTime());
		});

		it("returns null for non-existent membership", async () => {
			const result = await controller.cancelMembership("no-such-id");
			expect(result).toBeNull();
		});
	});
});
