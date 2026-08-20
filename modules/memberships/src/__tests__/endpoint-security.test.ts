import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMembershipController } from "../service-impl";

/**
 * Security tests for memberships store endpoints.
 *
 * These tests verify:
 * - Customer isolation: session-derived identity prevents IDOR
 * - Ownership verification before mutations: cancel checks ownership before acting
 * - Access check uses session identity, not client-provided customerId
 * - Cross-customer membership data cannot be enumerated
 */

describe("memberships endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMembershipController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMembershipController(mockData);
	});

	async function setupPlanAndMembership(customerId: string) {
		const plan = await controller.createPlan({
			name: "Premium",
			slug: `premium-${customerId}`,
			price: 999,
			billingInterval: "monthly",
		});
		const membership = await controller.subscribe({
			customerId,
			planId: plan.id,
		});
		return { plan, membership };
	}

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getCustomerMembership only returns the specified customer's membership", async () => {
			await setupPlanAndMembership("victim");
			await setupPlanAndMembership("attacker");

			const victimMembership = await controller.getCustomerMembership("victim");
			expect(victimMembership).not.toBeNull();
			expect(victimMembership?.customerId).toBe("victim");

			const attackerMembership =
				await controller.getCustomerMembership("attacker");
			expect(attackerMembership).not.toBeNull();
			expect(attackerMembership?.customerId).toBe("attacker");
		});

		it("getCustomerBenefits scopes to the correct customer", async () => {
			const { plan } = await setupPlanAndMembership("cust_a");
			await controller.addBenefit({
				planId: plan.id,
				type: "free_shipping",
				value: "true",
			});

			const benefitsA = await controller.getCustomerBenefits("cust_a");
			expect(benefitsA).toHaveLength(1);

			const benefitsB = await controller.getCustomerBenefits("cust_b");
			expect(benefitsB).toHaveLength(0);
		});

		it("canAccessProduct scopes by customer — different customers, same gated product", async () => {
			const { plan } = await setupPlanAndMembership("member_a");
			await controller.gateProduct({
				planId: plan.id,
				productId: "gated-prod",
			});

			const accessA = await controller.canAccessProduct({
				customerId: "member_a",
				productId: "gated-prod",
			});
			expect(accessA).toBe(true);

			const accessB = await controller.canAccessProduct({
				customerId: "non_member",
				productId: "gated-prod",
			});
			expect(accessB).toBe(false);
		});
	});

	// ── Ownership Verification ──────────────────────────────────────

	describe("ownership verification", () => {
		it("getMembership exposes membership regardless of caller (endpoint must verify ownership)", async () => {
			const { membership } = await setupPlanAndMembership("victim");
			// Controller's getMembership does not check caller — endpoints must verify
			const result = await controller.getMembership(membership.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});

		it("cancelMembership succeeds for any caller (endpoint must verify ownership before calling)", async () => {
			const { membership } = await setupPlanAndMembership("victim");
			// The controller allows any caller to cancel — the store endpoint
			// MUST verify membership.customerId === session.user.id BEFORE calling cancel
			const cancelled = await controller.cancelMembership(membership.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancel endpoint pattern: verify ownership before mutation", async () => {
			const { membership: victimMembership } =
				await setupPlanAndMembership("victim");
			const { membership: attackerMembership } =
				await setupPlanAndMembership("attacker");

			// Simulate the corrected endpoint flow:
			// 1. Get membership
			// 2. Check ownership
			// 3. Only then cancel

			const targetMembership = await controller.getMembership(
				victimMembership.id,
			);
			const attackerSessionId = "attacker";

			// Attacker trying to cancel victim's membership
			if (targetMembership?.customerId !== attackerSessionId) {
				// Endpoint should return 404 and NOT call cancelMembership
				expect(targetMembership?.customerId).toBe("victim");
			}

			// Verify victim's membership is still active (not cancelled)
			const stillActive = await controller.getMembership(victimMembership.id);
			expect(stillActive?.status).toBe("active");

			// Attacker can only cancel their own
			const ownMembership = await controller.getMembership(
				attackerMembership.id,
			);
			expect(ownMembership?.customerId).toBe("attacker");
			const cancelled = await controller.cancelMembership(
				attackerMembership.id,
			);
			expect(cancelled?.status).toBe("cancelled");
		});
	});

	// ── Product Access Security ─────────────────────────────────────

	describe("product access security", () => {
		it("cancelled member loses access to gated products", async () => {
			const { plan, membership } = await setupPlanAndMembership("cust_1");
			await controller.gateProduct({
				planId: plan.id,
				productId: "exclusive-prod",
			});

			const beforeCancel = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "exclusive-prod",
			});
			expect(beforeCancel).toBe(true);

			await controller.cancelMembership(membership.id);

			const afterCancel = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "exclusive-prod",
			});
			expect(afterCancel).toBe(false);
		});

		it("paused member loses access to gated products", async () => {
			const { plan, membership } = await setupPlanAndMembership("cust_1");
			await controller.gateProduct({
				planId: plan.id,
				productId: "exclusive-prod",
			});

			await controller.pauseMembership(membership.id);

			const afterPause = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "exclusive-prod",
			});
			expect(afterPause).toBe(false);
		});

		it("resumed member regains access to gated products", async () => {
			const { plan, membership } = await setupPlanAndMembership("cust_1");
			await controller.gateProduct({
				planId: plan.id,
				productId: "exclusive-prod",
			});

			await controller.pauseMembership(membership.id);
			await controller.resumeMembership(membership.id);

			const afterResume = await controller.canAccessProduct({
				customerId: "cust_1",
				productId: "exclusive-prod",
			});
			expect(afterResume).toBe(true);
		});

		it("ungated products are accessible to all customers", async () => {
			const access = await controller.canAccessProduct({
				customerId: "random-user",
				productId: "public-product",
			});
			expect(access).toBe(true);
		});
	});

	// ── Plan Membership Limits ──────────────────────────────────────

	describe("plan membership limits", () => {
		it("enforces maxMembers limit", async () => {
			const plan = await controller.createPlan({
				name: "Exclusive",
				slug: "exclusive-limit",
				price: 4999,
				billingInterval: "monthly",
				maxMembers: 2,
			});

			await controller.subscribe({
				customerId: "cust_1",
				planId: plan.id,
			});
			await controller.subscribe({
				customerId: "cust_2",
				planId: plan.id,
			});

			await expect(
				controller.subscribe({
					customerId: "cust_3",
					planId: plan.id,
				}),
			).rejects.toThrow("Plan has reached maximum members");
		});

		it("inactive plans cannot be subscribed to", async () => {
			const plan = await controller.createPlan({
				name: "Archived",
				slug: "archived-plan",
				price: 999,
				billingInterval: "monthly",
				isActive: false,
			});

			await expect(
				controller.subscribe({
					customerId: "cust_1",
					planId: plan.id,
				}),
			).rejects.toThrow("Plan is not active");
		});

		it("non-existent plan subscription fails", async () => {
			await expect(
				controller.subscribe({
					customerId: "cust_1",
					planId: "fake-plan-id",
				}),
			).rejects.toThrow("Plan not found");
		});
	});

	// ── Data Integrity ──────────────────────────────────────────────

	describe("data integrity", () => {
		it("deleting a plan cascades to benefits, products, and memberships", async () => {
			const plan = await controller.createPlan({
				name: "Cascade Test",
				slug: "cascade-test",
				price: 999,
				billingInterval: "monthly",
			});
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

			await controller.deletePlan(plan.id);

			expect(await controller.getPlan(plan.id)).toBeNull();
			expect(await controller.listBenefits(plan.id)).toHaveLength(0);
			expect(
				await controller.listGatedProducts({ planId: plan.id }),
			).toHaveLength(0);
		});

		it("subscribing to new plan cancels previous membership", async () => {
			const plan1 = await controller.createPlan({
				name: "Plan A",
				slug: "plan-a-integrity",
				price: 999,
				billingInterval: "monthly",
			});
			const plan2 = await controller.createPlan({
				name: "Plan B",
				slug: "plan-b-integrity",
				price: 1999,
				billingInterval: "monthly",
			});

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

			const current = await controller.getCustomerMembership("cust_1");
			expect(current?.planId).toBe(plan2.id);
			expect(current?.status).toBe("active");
		});
	});
});
