import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMembershipController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the memberships module.
 *
 * Covers: plan CRUD, subscription lifecycle (subscribe, cancel, pause, resume),
 * benefits management, product gating, listing/filtering, stats, and isolation.
 */

describe("memberships — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMembershipController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMembershipController(mockData);
	});

	// ── Plan CRUD ─────────────────────────────────────────────────

	describe("plan creation", () => {
		it("creates a monthly plan with defaults", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			expect(plan.id).toBeDefined();
			expect(plan.name).toBe("Basic");
			expect(plan.slug).toBe("basic");
			expect(plan.price).toBe(999);
			expect(plan.billingInterval).toBe("monthly");
			expect(plan.isActive).toBe(true);
		});

		it("creates a yearly plan with trial", async () => {
			const plan = await controller.createPlan({
				name: "Premium Annual",
				slug: "premium-annual",
				price: 9999,
				billingInterval: "yearly",
				trialDays: 14,
			});
			expect(plan.billingInterval).toBe("yearly");
			expect(plan.trialDays).toBe(14);
		});

		it("creates a plan with description and features", async () => {
			const plan = await controller.createPlan({
				name: "Pro",
				slug: "pro",
				price: 2999,
				billingInterval: "monthly",
				description: "For power users",
				features: ["Priority support", "Early access", "Custom badge"],
			});
			expect(plan.description).toBe("For power users");
			expect(plan.features).toEqual([
				"Priority support",
				"Early access",
				"Custom badge",
			]);
		});

		it("creates a plan with max members and sort order", async () => {
			const plan = await controller.createPlan({
				name: "Enterprise",
				slug: "enterprise",
				price: 49999,
				billingInterval: "yearly",
				maxMembers: 100,
				sortOrder: 5,
			});
			expect(plan.maxMembers).toBe(100);
			expect(plan.sortOrder).toBe(5);
		});

		it("creates an inactive plan", async () => {
			const plan = await controller.createPlan({
				name: "Draft",
				slug: "draft",
				price: 999,
				billingInterval: "monthly",
				isActive: false,
			});
			expect(plan.isActive).toBe(false);
		});
	});

	describe("plan retrieval and listing", () => {
		it("gets plan by id", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const found = await controller.getPlan(plan.id);
			expect(found?.name).toBe("Basic");
		});

		it("getPlan returns null for unknown id", async () => {
			const result = await controller.getPlan("fake-id");
			expect(result).toBeNull();
		});

		it("gets plan by slug", async () => {
			await controller.createPlan({
				name: "Pro",
				slug: "pro",
				price: 2999,
				billingInterval: "monthly",
			});
			const found = await controller.getPlanBySlug("pro");
			expect(found?.name).toBe("Pro");
		});

		it("getPlanBySlug returns null for unknown slug", async () => {
			const result = await controller.getPlanBySlug("nonexistent");
			expect(result).toBeNull();
		});

		it("lists all plans", async () => {
			await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.createPlan({
				name: "Pro",
				slug: "pro",
				price: 2999,
				billingInterval: "monthly",
			});
			const plans = await controller.listPlans({});
			expect(plans).toHaveLength(2);
		});

		it("lists active-only plans", async () => {
			await controller.createPlan({
				name: "Active",
				slug: "active",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.createPlan({
				name: "Inactive",
				slug: "inactive",
				price: 999,
				billingInterval: "monthly",
				isActive: false,
			});
			const active = await controller.listPlans({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("paginates plans", async () => {
			for (let i = 0; i < 8; i++) {
				await controller.createPlan({
					name: `Plan ${i}`,
					slug: `plan-${i}`,
					price: 999,
					billingInterval: "monthly",
				});
			}
			const page = await controller.listPlans({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});

		it("counts plans", async () => {
			await controller.createPlan({
				name: "A",
				slug: "a",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.createPlan({
				name: "B",
				slug: "b",
				price: 999,
				billingInterval: "monthly",
				isActive: false,
			});
			expect(await controller.countPlans({})).toBe(2);
			expect(await controller.countPlans({ isActive: true })).toBe(1);
		});
	});

	describe("plan update", () => {
		it("updates plan name and price", async () => {
			const plan = await controller.createPlan({
				name: "Old",
				slug: "old",
				price: 999,
				billingInterval: "monthly",
			});
			const updated = await controller.updatePlan(plan.id, {
				name: "New",
				price: 1999,
			});
			expect(updated?.name).toBe("New");
			expect(updated?.price).toBe(1999);
		});

		it("updates features", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				slug: "plan",
				price: 999,
				billingInterval: "monthly",
			});
			const updated = await controller.updatePlan(plan.id, {
				features: ["Feature A", "Feature B"],
			});
			expect(updated?.features).toEqual(["Feature A", "Feature B"]);
		});

		it("deactivates a plan", async () => {
			const plan = await controller.createPlan({
				name: "Plan",
				slug: "plan",
				price: 999,
				billingInterval: "monthly",
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
				name: "To Delete",
				slug: "delete",
				price: 999,
				billingInterval: "monthly",
			});
			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);
			const found = await controller.getPlan(plan.id);
			expect(found).toBeNull();
		});

		it("deletePlan returns false for unknown id", async () => {
			const result = await controller.deletePlan("fake-id");
			expect(result).toBe(false);
		});
	});

	// ── Membership lifecycle ──────────────────────────────────────

	describe("subscribe", () => {
		it("subscribes a customer to a plan", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			expect(membership.id).toBeDefined();
			expect(membership.customerId).toBe("cust_1");
			expect(membership.planId).toBe(plan.id);
			expect(membership.status).toBe("active");
		});
	});

	describe("cancel membership", () => {
		it("cancels an active membership", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const cancelled = await controller.cancelMembership(membership.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancelMembership returns null for unknown id", async () => {
			const result = await controller.cancelMembership("fake-id");
			expect(result).toBeNull();
		});
	});

	describe("pause and resume", () => {
		it("pauses an active membership", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const paused = await controller.pauseMembership(membership.id);
			expect(paused?.status).toBe("paused");
		});

		it("resumes a paused membership", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.pauseMembership(membership.id);
			const resumed = await controller.resumeMembership(membership.id);
			expect(resumed?.status).toBe("active");
		});

		it("pauseMembership returns null for unknown id", async () => {
			const result = await controller.pauseMembership("fake-id");
			expect(result).toBeNull();
		});

		it("resumeMembership returns null for unknown id", async () => {
			const result = await controller.resumeMembership("fake-id");
			expect(result).toBeNull();
		});
	});

	describe("membership retrieval", () => {
		it("gets membership by id", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const membership = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const found = await controller.getMembership(membership.id);
			expect(found?.customerId).toBe("cust_1");
		});

		it("getMembership returns null for unknown id", async () => {
			const result = await controller.getMembership("fake-id");
			expect(result).toBeNull();
		});

		it("gets customer membership with plan details", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const found = await controller.getCustomerMembership("cust_1");
			expect(found?.plan).toBeDefined();
			expect(found?.plan.name).toBe("Basic");
		});

		it("getCustomerMembership returns null for non-member", async () => {
			const result = await controller.getCustomerMembership("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("membership listing", () => {
		it("lists all memberships", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.subscribe({ customerId: "cust_1", planId: plan.id });
			await controller.subscribe({ customerId: "cust_2", planId: plan.id });
			await controller.subscribe({ customerId: "cust_3", planId: plan.id });

			const all = await controller.listMemberships({});
			expect(all).toHaveLength(3);
		});

		it("filters by planId", async () => {
			const planA = await controller.createPlan({
				name: "A",
				slug: "a",
				price: 999,
				billingInterval: "monthly",
			});
			const planB = await controller.createPlan({
				name: "B",
				slug: "b",
				price: 1999,
				billingInterval: "monthly",
			});
			await controller.subscribe({ customerId: "cust_1", planId: planA.id });
			await controller.subscribe({ customerId: "cust_2", planId: planB.id });

			const result = await controller.listMemberships({ planId: planA.id });
			expect(result).toHaveLength(1);
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.cancelMembership(m1.id);

			const active = await controller.listMemberships({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("paginates memberships", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			for (let i = 0; i < 10; i++) {
				await controller.subscribe({
					customerId: `cust_${i}`,
					planId: plan.id,
				});
			}
			const page = await controller.listMemberships({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});

		it("counts memberships", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.cancelMembership(m1.id);

			expect(await controller.countMemberships({})).toBe(2);
			expect(await controller.countMemberships({ status: "active" })).toBe(1);
		});
	});

	// ── Benefits ──────────────────────────────────────────────────

	describe("benefits", () => {
		it("adds a benefit to a plan", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const benefit = await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "10%",
				description: "10% off all orders",
			});
			expect(benefit.id).toBeDefined();
			expect(benefit.type).toBe("discount_percentage");
			expect(benefit.value).toBe("10%");
		});

		it("lists benefits for a plan", async () => {
			const plan = await controller.createPlan({
				name: "Pro",
				slug: "pro",
				price: 2999,
				billingInterval: "monthly",
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "15%",
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});
			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(2);
		});

		it("removes a benefit", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			const benefit = await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "10%",
			});
			const removed = await controller.removeBenefit(benefit.id);
			expect(removed).toBe(true);
			const benefits = await controller.listBenefits(plan.id);
			expect(benefits).toHaveLength(0);
		});

		it("removeBenefit returns false for unknown id", async () => {
			const result = await controller.removeBenefit("fake-id");
			expect(result).toBe(false);
		});

		it("gets customer benefits from active membership", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.addBenefit({
				planId: plan.id,
				type: "discount_percentage",
				value: "10%",
			});
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			const benefits = await controller.getCustomerBenefits("cust_1");
			expect(benefits).toHaveLength(1);
			expect(benefits[0].type).toBe("discount_percentage");
		});

		it("customer with no membership gets empty benefits", async () => {
			const benefits = await controller.getCustomerBenefits("nonmember");
			expect(benefits).toHaveLength(0);
		});
	});

	// ── Product gating ────────────────────────────────────────────

	describe("product gating", () => {
		it("gates a product to a plan", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			const gated = await controller.gateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			expect(gated.planId).toBe(plan.id);
			expect(gated.productId).toBe("prod_1");
		});

		it("lists gated products for a plan", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({ planId: plan.id, productId: "prod_1" });
			await controller.gateProduct({ planId: plan.id, productId: "prod_2" });
			await controller.gateProduct({ planId: plan.id, productId: "prod_3" });

			const products = await controller.listGatedProducts({
				planId: plan.id,
			});
			expect(products).toHaveLength(3);
		});

		it("counts gated products", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({ planId: plan.id, productId: "prod_1" });
			await controller.gateProduct({ planId: plan.id, productId: "prod_2" });

			const count = await controller.countGatedProducts(plan.id);
			expect(count).toBe(2);
		});

		it("ungates a product", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({ planId: plan.id, productId: "prod_1" });
			const result = await controller.ungateProduct({
				planId: plan.id,
				productId: "prod_1",
			});
			expect(result).toBe(true);
			const count = await controller.countGatedProducts(plan.id);
			expect(count).toBe(0);
		});

		it("member can access gated product", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({ planId: plan.id, productId: "prod_1" });
			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});

			const canAccess = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(canAccess).toBe(true);
		});

		it("non-member cannot access gated product", async () => {
			const plan = await controller.createPlan({
				name: "VIP",
				slug: "vip",
				price: 4999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({ planId: plan.id, productId: "prod_1" });

			const canAccess = await controller.canAccessProduct({
				customerId: "nonmember",
				productId: "prod_1",
			});
			expect(canAccess).toBe(false);
		});

		it("non-gated product is accessible to everyone", async () => {
			const canAccess = await controller.canAccessProduct({
				customerId: "anyone",
				productId: "ungated_product",
			});
			expect(canAccess).toBe(true);
		});
	});

	// ── Stats ─────────────────────────────────────────────────────

	describe("stats", () => {
		it("returns zeros on empty database", async () => {
			const stats = await controller.getStats();
			expect(stats.totalMembers).toBe(0);
			expect(stats.activeMembers).toBe(0);
			expect(stats.totalPlans).toBe(0);
		});

		it("counts members and plans", async () => {
			const plan = await controller.createPlan({
				name: "Basic",
				slug: "basic",
				price: 999,
				billingInterval: "monthly",
			});
			await controller.createPlan({
				name: "Pro",
				slug: "pro",
				price: 2999,
				billingInterval: "monthly",
			});
			const m1 = await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});
			await controller.cancelMembership(m1.id);

			const stats = await controller.getStats();
			expect(stats.totalPlans).toBe(2);
			expect(stats.totalMembers).toBe(2);
			expect(stats.activeMembers).toBe(1);
		});
	});

	// ── Multi-plan isolation ──────────────────────────────────────

	describe("multi-plan isolation", () => {
		it("different plans have independent member counts", async () => {
			const planA = await controller.createPlan({
				name: "A",
				slug: "a",
				price: 999,
				billingInterval: "monthly",
			});
			const planB = await controller.createPlan({
				name: "B",
				slug: "b",
				price: 1999,
				billingInterval: "monthly",
			});
			await controller.subscribe({ customerId: "cust_1", planId: planA.id });
			await controller.subscribe({ customerId: "cust_2", planId: planA.id });
			await controller.subscribe({ customerId: "cust_3", planId: planB.id });

			const aSubs = await controller.listMemberships({ planId: planA.id });
			const bSubs = await controller.listMemberships({ planId: planB.id });
			expect(aSubs).toHaveLength(2);
			expect(bSubs).toHaveLength(1);
		});

		it("gated products are plan-specific", async () => {
			const planA = await controller.createPlan({
				name: "A",
				slug: "a",
				price: 999,
				billingInterval: "monthly",
			});
			const planB = await controller.createPlan({
				name: "B",
				slug: "b",
				price: 1999,
				billingInterval: "monthly",
			});
			await controller.gateProduct({
				planId: planA.id,
				productId: "prod_1",
			});

			expect(await controller.countGatedProducts(planA.id)).toBe(1);
			expect(await controller.countGatedProducts(planB.id)).toBe(0);
		});
	});
});
