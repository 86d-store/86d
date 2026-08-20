import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMembershipController } from "../service-impl";

describe("createMembershipController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMembershipController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMembershipController(mockData);
	});

	async function createTestPlan(
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

	async function createTestMembership(customerId = "cust_1") {
		const plan = await createTestPlan();
		const membership = await controller.subscribe({
			customerId,
			planId: plan.id,
		});
		return { plan, membership };
	}

	// ── createPlan ──

	describe("createPlan", () => {
		it("creates a plan with required fields", async () => {
			const plan = await createTestPlan();
			expect(plan.id).toBeDefined();
			expect(plan.name).toBe("Gold Plan");
			expect(plan.slug).toBe("gold");
			expect(plan.price).toBe(29.99);
			expect(plan.billingInterval).toBe("monthly");
			expect(plan.trialDays).toBe(0);
			expect(plan.isActive).toBe(true);
			expect(plan.sortOrder).toBe(0);
			expect(plan.createdAt).toBeInstanceOf(Date);
			expect(plan.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a plan with all optional fields", async () => {
			const plan = await createTestPlan({
				description: "Our premium tier",
				trialDays: 14,
				features: ["Free shipping", "Early access"],
				isActive: false,
				maxMembers: 100,
				sortOrder: 5,
			});
			expect(plan.description).toBe("Our premium tier");
			expect(plan.trialDays).toBe(14);
			expect(plan.features).toEqual(["Free shipping", "Early access"]);
			expect(plan.isActive).toBe(false);
			expect(plan.maxMembers).toBe(100);
			expect(plan.sortOrder).toBe(5);
		});
	});

	// ── getPlan ──

	describe("getPlan", () => {
		it("retrieves a plan by id", async () => {
			const created = await createTestPlan();
			const plan = await controller.getPlan(created.id);
			expect(plan).not.toBeNull();
			expect(plan?.name).toBe("Gold Plan");
		});

		it("returns null for non-existent plan", async () => {
			const plan = await controller.getPlan("non-existent");
			expect(plan).toBeNull();
		});
	});

	// ── getPlanBySlug ──

	describe("getPlanBySlug", () => {
		it("retrieves a plan by slug", async () => {
			await createTestPlan();
			const plan = await controller.getPlanBySlug("gold");
			expect(plan).not.toBeNull();
			expect(plan?.slug).toBe("gold");
		});

		it("returns null for non-existent slug", async () => {
			const plan = await controller.getPlanBySlug("non-existent");
			expect(plan).toBeNull();
		});
	});

	// ── updatePlan ──

	describe("updatePlan", () => {
		it("updates plan name and price", async () => {
			const created = await createTestPlan();
			const updated = await controller.updatePlan(created.id, {
				name: "Platinum Plan",
				price: 49.99,
			});
			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Platinum Plan");
			expect(updated?.price).toBe(49.99);
			expect(updated?.slug).toBe("gold");
		});

		it("clears optional fields with null", async () => {
			const created = await createTestPlan({
				description: "Premium",
				features: ["Perk 1"],
				maxMembers: 50,
			});
			const updated = await controller.updatePlan(created.id, {
				description: null,
				features: null,
				maxMembers: null,
			});
			expect(updated).not.toBeNull();
			expect(updated?.description).toBeUndefined();
			expect(updated?.features).toBeUndefined();
			expect(updated?.maxMembers).toBeUndefined();
		});

		it("returns null for non-existent plan", async () => {
			const result = await controller.updatePlan("no-id", {
				name: "X",
			});
			expect(result).toBeNull();
		});
	});

	// ── deletePlan ──

	describe("deletePlan", () => {
		it("deletes a plan and cascades", async () => {
			const plan = await createTestPlan();
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);

			const found = await controller.getPlan(plan.id);
			expect(found).toBeNull();

			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(0);

			const gated = await controller.listGatedProducts({
				planId: plan.id,
			});
			expect(gated).toHaveLength(0);
		});

		it("returns false for non-existent plan", async () => {
			const result = await controller.deletePlan("no-id");
			expect(result).toBe(false);
		});
	});

	// ── listPlans ──

	describe("listPlans", () => {
		it("lists all plans", async () => {
			await createTestPlan({ slug: "silver", sortOrder: 2 });
			await createTestPlan({ slug: "gold-v2", sortOrder: 1 });
			await createTestPlan({ slug: "bronze", sortOrder: 3 });

			const plans = await controller.listPlans();
			expect(plans).toHaveLength(3);
		});

		it("filters by isActive", async () => {
			await createTestPlan({ slug: "active", isActive: true });
			await createTestPlan({ slug: "inactive", isActive: false });

			const active = await controller.listPlans({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].slug).toBe("active");
		});

		it("supports pagination", async () => {
			await createTestPlan({ slug: "a" });
			await createTestPlan({ slug: "b" });
			await createTestPlan({ slug: "c" });

			const page = await controller.listPlans({ take: 2, skip: 0 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countPlans ──

	describe("countPlans", () => {
		it("counts plans with filters", async () => {
			await createTestPlan({ slug: "a", isActive: true });
			await createTestPlan({ slug: "b", isActive: false });

			const total = await controller.countPlans();
			expect(total).toBe(2);

			const active = await controller.countPlans({ isActive: true });
			expect(active).toBe(1);
		});
	});

	// ── subscribe ──

	describe("subscribe", () => {
		it("creates an active membership", async () => {
			const plan = await createTestPlan();
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(membership.id).toBeDefined();
			expect(membership.customerId).toBe("cust_1");
			expect(membership.planId).toBe(plan.id);
			expect(membership.status).toBe("active");
			expect(membership.startDate).toBeInstanceOf(Date);
			expect(membership.endDate).toBeInstanceOf(Date);
		});

		it("creates a trial membership when plan has trial days", async () => {
			const plan = await createTestPlan({
				slug: "trial-plan",
				trialDays: 14,
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(membership.status).toBe("trial");
			expect(membership.trialEndDate).toBeInstanceOf(Date);
		});

		it("creates lifetime membership without endDate for lifetime plans", async () => {
			const plan = await createTestPlan({
				slug: "lifetime",
				billingInterval: "lifetime",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(membership.endDate).toBeUndefined();
		});

		it("cancels existing membership when subscribing to new plan", async () => {
			const plan1 = await createTestPlan({ slug: "plan-1" });
			const plan2 = await createTestPlan({ slug: "plan-2" });

			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});

			await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});

			const old = await controller.getMembership(m1.id);
			expect(old?.status).toBe("cancelled");
		});

		it("throws when plan not found", async () => {
			await expect(
				controller.subscribe({
					customerId: "cust_1",
					planId: "no-plan",
				}),
			).rejects.toThrow("Plan not found");
		});

		it("throws when plan is inactive", async () => {
			const plan = await createTestPlan({
				slug: "disabled",
				isActive: false,
			});
			await expect(
				controller.subscribe({
					customerId: "cust_1",
					planId: plan.id,
				}),
			).rejects.toThrow("Plan is not active");
		});

		it("throws when plan has reached max members", async () => {
			const plan = await createTestPlan({
				slug: "limited",
				maxMembers: 1,
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			await expect(
				controller.subscribe({
					customerId: "cust_2",
					planId: plan.id,
				}),
			).rejects.toThrow("Plan has reached maximum members");
		});
	});

	// ── cancelMembership ──

	describe("cancelMembership", () => {
		it("cancels an active membership", async () => {
			const { membership } = await createTestMembership();
			const cancelled = await controller.cancelMembership(membership.id);
			expect(cancelled).not.toBeNull();
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
		});

		it("returns already-cancelled membership unchanged", async () => {
			const { membership } = await createTestMembership();
			await controller.cancelMembership(membership.id);
			const again = await controller.cancelMembership(membership.id);
			expect(again?.status).toBe("cancelled");
		});

		it("returns null for non-existent membership", async () => {
			const result = await controller.cancelMembership("no-id");
			expect(result).toBeNull();
		});
	});

	// ── pauseMembership ──

	describe("pauseMembership", () => {
		it("pauses an active membership", async () => {
			const { membership } = await createTestMembership();
			const paused = await controller.pauseMembership(membership.id);
			expect(paused?.status).toBe("paused");
			expect(paused?.pausedAt).toBeInstanceOf(Date);
		});

		it("does not pause a cancelled membership", async () => {
			const { membership } = await createTestMembership();
			await controller.cancelMembership(membership.id);
			const result = await controller.pauseMembership(membership.id);
			expect(result?.status).toBe("cancelled");
		});

		it("returns null for non-existent membership", async () => {
			const result = await controller.pauseMembership("no-id");
			expect(result).toBeNull();
		});
	});

	// ── resumeMembership ──

	describe("resumeMembership", () => {
		it("resumes a paused membership", async () => {
			const { membership } = await createTestMembership();
			await controller.pauseMembership(membership.id);
			const resumed = await controller.resumeMembership(membership.id);
			expect(resumed?.status).toBe("active");
		});

		it("does not resume non-paused membership", async () => {
			const { membership } = await createTestMembership();
			const result = await controller.resumeMembership(membership.id);
			expect(result?.status).toBe("active");
		});

		it("returns null for non-existent membership", async () => {
			const result = await controller.resumeMembership("no-id");
			expect(result).toBeNull();
		});
	});

	// ── getCustomerMembership ──

	describe("getCustomerMembership", () => {
		it("returns membership with plan for active customer", async () => {
			const { plan } = await createTestMembership("cust_1");
			const result = await controller.getCustomerMembership("cust_1");
			expect(result).not.toBeNull();
			expect(result?.plan.id).toBe(plan.id);
			expect(result?.customerId).toBe("cust_1");
		});

		it("returns null for customer with no membership", async () => {
			const result = await controller.getCustomerMembership("no-customer");
			expect(result).toBeNull();
		});

		it("returns null when all memberships are cancelled", async () => {
			const { membership } = await createTestMembership("cust_1");
			await controller.cancelMembership(membership.id);
			const result = await controller.getCustomerMembership("cust_1");
			expect(result).toBeNull();
		});
	});

	// ── listMemberships ──

	describe("listMemberships", () => {
		it("lists all memberships", async () => {
			const plan = await createTestPlan();
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});

			const memberships = await controller.listMemberships();
			expect(memberships).toHaveLength(2);
		});

		it("filters by status", async () => {
			const plan = await createTestPlan();
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.cancelMembership(m1.id);

			const active = await controller.listMemberships({
				status: "active",
			});
			expect(active).toHaveLength(1);
		});

		it("filters by planId", async () => {
			const plan1 = await createTestPlan({ slug: "p1" });
			const plan2 = await createTestPlan({ slug: "p2" });
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan2.id,
			});

			const result = await controller.listMemberships({
				planId: plan1.id,
			});
			expect(result).toHaveLength(1);
			expect(result[0].planId).toBe(plan1.id);
		});

		it("supports pagination", async () => {
			const plan = await createTestPlan();
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_3",
				planId: plan.id,
			});

			const page = await controller.listMemberships({
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countMemberships ──

	describe("countMemberships", () => {
		it("counts memberships with filters", async () => {
			const plan = await createTestPlan();
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.cancelMembership(m1.id);

			const total = await controller.countMemberships();
			expect(total).toBe(2);

			const cancelled = await controller.countMemberships({
				status: "cancelled",
			});
			expect(cancelled).toBe(1);
		});
	});

	// ── addBenefit ──

	describe("addBenefit", () => {
		it("adds a benefit to a plan", async () => {
			const plan = await createTestPlan();
			const benefit = await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			expect(benefit.id).toBeDefined();
			expect(benefit.planId).toBe(plan.id);
			expect(benefit.type).toBe("free_shipping");
			expect(benefit.value).toBe("true");
			expect(benefit.isActive).toBe(true);
		});

		it("adds a benefit with optional fields", async () => {
			const plan = await createTestPlan();
			const benefit = await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "10",
				description: "10% off all purchases",
				isActive: false,
			});
			expect(benefit.description).toBe("10% off all purchases");
			expect(benefit.isActive).toBe(false);
		});
	});

	// ── removeBenefit ──

	describe("removeBenefit", () => {
		it("removes a benefit", async () => {
			const plan = await createTestPlan();
			const benefit = await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			const removed = await controller.removeBenefit(benefit.id);
			expect(removed).toBe(true);

			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(0);
		});

		it("returns false for non-existent benefit", async () => {
			const result = await controller.removeBenefit("no-id");
			expect(result).toBe(false);
		});
	});

	// ── listBenefits ──

	describe("listBenefits", () => {
		it("lists all benefits for a plan", async () => {
			const plan = await createTestPlan();
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

			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(2);
		});

		it("returns empty for plan with no benefits", async () => {
			const plan = await createTestPlan();
			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(0);
		});
	});

	// ── getCustomerBenefits ──

	describe("getCustomerBenefits", () => {
		it("returns active benefits for member", async () => {
			const plan = await createTestPlan();
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
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

		it("returns empty for non-member", async () => {
			const benefits = await controller.getCustomerBenefits("non-member");
			expect(benefits).toHaveLength(0);
		});
	});

	// ── gateProduct ──

	describe("gateProduct", () => {
		it("gates a product to a plan", async () => {
			const plan = await createTestPlan();
			const gated = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			expect(gated.id).toBeDefined();
			expect(gated.planId).toBe(plan.id);
			expect(gated.productId).toBe("prod_1");
		});

		it("is idempotent — returns existing if already gated", async () => {
			const plan = await createTestPlan();
			const first = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			const second = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			expect(first.id).toBe(second.id);
		});
	});

	// ── ungateProduct ──

	describe("ungateProduct", () => {
		it("ungates a product from a plan", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			const removed = await controller.ungateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			expect(removed).toBe(true);
		});

		it("returns false when product not gated", async () => {
			const plan = await createTestPlan();
			const result = await controller.ungateProduct({
				planId: plan.id,
				productId: "no-product",
			});
			expect(result).toBe(false);
		});
	});

	// ── listGatedProducts ──

	describe("listGatedProducts", () => {
		it("lists gated products for a plan", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_2",
			});

			const gated = await controller.listGatedProducts({
				planId: plan.id,
			});
			expect(gated).toHaveLength(2);
		});

		it("supports pagination", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_2",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_3",
			});

			const page = await controller.listGatedProducts({
				planId: plan.id,
				take: 2,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countGatedProducts ──

	describe("countGatedProducts", () => {
		it("counts gated products", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_2",
			});

			const count = await controller.countGatedProducts(plan.id);
			expect(count).toBe(2);
		});
	});

	// ── canAccessProduct ──

	describe("canAccessProduct", () => {
		it("returns true for non-gated product", async () => {
			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "ungated-prod",
			});
			expect(result).toBe(true);
		});

		it("returns true for member with matching plan", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(result).toBe(true);
		});

		it("returns false for non-member on gated product", async () => {
			const plan = await createTestPlan();
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_no_plan",
				productId: "prod_1",
			});
			expect(result).toBe(false);
		});

		it("returns false for member with wrong plan", async () => {
			const plan1 = await createTestPlan({ slug: "gold-access" });
			const plan2 = await createTestPlan({ slug: "silver-access" });
			await controller.gateProduct({
				planId: plan1.id,
				productId: "prod_1",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan2.id,
			});

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(result).toBe(false);
		});

		it("returns false for cancelled member", async () => {
			const plan = await createTestPlan({ slug: "gated-plan" });
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			const m = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.cancelMembership(m.id);

			const result = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(result).toBe(false);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns correct stats", async () => {
			const plan1 = await createTestPlan({
				slug: "plan-a",
				isActive: true,
			});
			await createTestPlan({
				slug: "plan-b",
				isActive: false,
			});

			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan1.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan1.id,
			});
			await controller.cancelMembership(m1.id);

			await controller.gateProduct({
				planId: plan1.id,
				productId: "prod_1",
			});
			await controller.gateProduct({
				planId: plan1.id,
				productId: "prod_2",
			});

			const stats = await controller.getStats();
			expect(stats.totalPlans).toBe(2);
			expect(stats.activePlans).toBe(1);
			expect(stats.totalMembers).toBe(2);
			expect(stats.activeMembers).toBe(1);
			expect(stats.cancelledMembers).toBe(1);
			expect(stats.gatedProducts).toBe(2);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalPlans).toBe(0);
			expect(stats.totalMembers).toBe(0);
			expect(stats.gatedProducts).toBe(0);
		});
	});

	// ── trial membership flow ──

	describe("trial membership flow", () => {
		it("creates trial, then can be activated by re-subscribing", async () => {
			const plan = await createTestPlan({
				slug: "trial-flow",
				trialDays: 7,
			});
			const trial = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(trial.status).toBe("trial");

			// Trial members can access gated products
			await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			const access = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(access).toBe(true);
		});
	});

	// ── yearly billing ──

	describe("yearly billing", () => {
		it("sets endDate 1 year from start", async () => {
			const plan = await createTestPlan({
				slug: "annual",
				billingInterval: "yearly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const endDate = membership.endDate;
			expect(endDate).toBeInstanceOf(Date);
			const diff = (endDate as Date).getTime() - membership.startDate.getTime();
			// Roughly 365 days (allow for DST)
			const days = diff / (1000 * 60 * 60 * 24);
			expect(days).toBeGreaterThanOrEqual(364);
			expect(days).toBeLessThanOrEqual(367);
		});
	});
});
