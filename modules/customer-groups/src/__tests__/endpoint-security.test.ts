import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerGroupControllers } from "../service-impl";

/**
 * Security regression tests for customer-groups endpoints.
 *
 * Customer groups have store endpoints (scoped to authenticated user)
 * and admin CRUD. Security focuses on:
 * - Customer can only see their own group memberships
 * - Expired memberships are excluded from active queries
 * - Inactive groups are hidden from customer-facing endpoints
 * - Cascade deletion removes memberships, rules, and price adjustments
 * - Automatic rule evaluation only matches active groups
 * - Duplicate membership prevention
 */

describe("customer-groups endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCustomerGroupControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerGroupControllers(mockData);
	});

	describe("customer scoping", () => {
		it("getCustomerGroups only returns groups for the given customer", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			const cust1Groups = await controller.getCustomerGroups("cust_1");
			expect(cust1Groups).toHaveLength(1);

			const cust2Groups = await controller.getCustomerGroups("cust_2");
			expect(cust2Groups).toHaveLength(0);
		});

		it("isMember correctly scopes to customer", async () => {
			const group = await controller.createGroup({
				name: "Gold",
				slug: "gold",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			expect(await controller.isMember(group.id, "cust_1")).toBe(true);
			expect(await controller.isMember(group.id, "cust_2")).toBe(false);
		});
	});

	describe("expired membership handling", () => {
		it("expired memberships are excluded from getCustomerGroups", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
				expiresAt: new Date(Date.now() - 3600_000), // expired 1 hour ago
			});

			const groups = await controller.getCustomerGroups("cust_1");
			expect(groups).toHaveLength(0);
		});

		it("expired memberships return false for isMember", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
				expiresAt: new Date(Date.now() - 3600_000),
			});

			expect(await controller.isMember(group.id, "cust_1")).toBe(false);
		});

		it("non-expired memberships are included", async () => {
			const group = await controller.createGroup({
				name: "Premium",
				slug: "premium",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
				expiresAt: new Date(Date.now() + 3600_000), // expires in 1 hour
			});

			const groups = await controller.getCustomerGroups("cust_1");
			expect(groups).toHaveLength(1);
			expect(await controller.isMember(group.id, "cust_1")).toBe(true);
		});

		it("memberships without expiry are always active", async () => {
			const group = await controller.createGroup({
				name: "Lifetime",
				slug: "lifetime",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			expect(await controller.isMember(group.id, "cust_1")).toBe(true);
		});
	});

	describe("inactive group filtering", () => {
		it("inactive groups are hidden from getCustomerGroups by default", async () => {
			const group = await controller.createGroup({
				name: "Inactive Group",
				slug: "inactive",
			});
			await controller.updateGroup(group.id, { isActive: false });
			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			const groups = await controller.getCustomerGroups("cust_1");
			expect(groups).toHaveLength(0);
		});

		it("inactive groups are hidden from getCustomerPricing", async () => {
			const group = await controller.createGroup({
				name: "Discounted",
				slug: "discounted",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			// Deactivate the group
			await controller.updateGroup(group.id, { isActive: false });

			const pricing = await controller.getCustomerPricing("cust_1");
			expect(pricing).toHaveLength(0);
		});
	});

	describe("duplicate membership prevention", () => {
		it("addMember throws if customer is already a member", async () => {
			const group = await controller.createGroup({
				name: "Exclusive",
				slug: "exclusive",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			await expect(
				controller.addMember({
					groupId: group.id,
					customerId: "cust_1",
				}),
			).rejects.toThrow("already a member");
		});

		it("bulkAddMembers skips existing members", async () => {
			const group = await controller.createGroup({
				name: "Bulk",
				slug: "bulk",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			const added = await controller.bulkAddMembers(group.id, [
				"cust_1",
				"cust_2",
				"cust_3",
			]);
			expect(added).toBe(2); // Only cust_2 and cust_3 are new
		});
	});

	describe("cascade deletion", () => {
		it("deleteGroup removes all memberships", async () => {
			const group = await controller.createGroup({
				name: "Doomed",
				slug: "doomed",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust_2",
			});

			await controller.deleteGroup(group.id);

			const cust1Groups = await controller.getCustomerGroups("cust_1");
			expect(cust1Groups).toHaveLength(0);
		});

		it("deleteGroup removes all rules", async () => {
			const group = await controller.createGroup({
				name: "RuleGroup",
				slug: "rule-group",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalOrders",
				operator: "greater_than",
				value: "5",
			});

			await controller.deleteGroup(group.id);

			const rules = await controller.listRules(group.id);
			expect(rules).toHaveLength(0);
		});

		it("deleteGroup removes all price adjustments", async () => {
			const group = await controller.createGroup({
				name: "PriceGroup",
				slug: "price-group",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			await controller.deleteGroup(group.id);

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(0);
		});

		it("deleteGroup does not affect other groups", async () => {
			const group1 = await controller.createGroup({
				name: "Group 1",
				slug: "group-1",
			});
			const group2 = await controller.createGroup({
				name: "Group 2",
				slug: "group-2",
			});
			await controller.addMember({
				groupId: group1.id,
				customerId: "cust_1",
			});
			await controller.addMember({
				groupId: group2.id,
				customerId: "cust_1",
			});

			await controller.deleteGroup(group1.id);

			const groups = await controller.getCustomerGroups("cust_1");
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe("Group 2");
		});
	});

	describe("automatic rule evaluation", () => {
		it("evaluateRules only matches active automatic groups", async () => {
			const activeGroup = await controller.createGroup({
				name: "Active Auto",
				slug: "active-auto",
				type: "automatic",
			});
			await controller.addRule({
				groupId: activeGroup.id,
				field: "totalOrders",
				operator: "greater_than",
				value: "5",
			});

			const inactiveGroup = await controller.createGroup({
				name: "Inactive Auto",
				slug: "inactive-auto",
				type: "automatic",
			});
			await controller.addRule({
				groupId: inactiveGroup.id,
				field: "totalOrders",
				operator: "greater_than",
				value: "5",
			});
			await controller.updateGroup(inactiveGroup.id, { isActive: false });

			const matches = await controller.evaluateRules({ totalOrders: 10 });
			expect(matches).toHaveLength(1);
			expect(matches[0]).toBe(activeGroup.id);
		});

		it("evaluateRules ignores manual groups", async () => {
			const manualGroup = await controller.createGroup({
				name: "Manual",
				slug: "manual",
				type: "manual",
			});
			await controller.addRule({
				groupId: manualGroup.id,
				field: "totalOrders",
				operator: "greater_than",
				value: "5",
			});

			const matches = await controller.evaluateRules({ totalOrders: 10 });
			expect(matches).toHaveLength(0);
		});

		it("evaluateRules requires ALL rules to match (AND logic)", async () => {
			const group = await controller.createGroup({
				name: "Strict",
				slug: "strict",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalOrders",
				operator: "greater_than",
				value: "5",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});

			// Only one rule matches
			const partial = await controller.evaluateRules({
				totalOrders: 10,
				totalSpent: 500,
			});
			expect(partial).toHaveLength(0);

			// Both match
			const full = await controller.evaluateRules({
				totalOrders: 10,
				totalSpent: 2000,
			});
			expect(full).toHaveLength(1);
		});
	});

	describe("price adjustment scoping", () => {
		it("getCustomerPricing filters by scope when specified", async () => {
			const group = await controller.createGroup({
				name: "Pricing",
				slug: "pricing",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust_1",
			});

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
				scope: "all",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "category",
				scopeId: "cat_1",
			});

			const allPricing = await controller.getCustomerPricing("cust_1");
			expect(allPricing).toHaveLength(2);

			const catPricing = await controller.getCustomerPricing("cust_1", {
				scope: "category",
				scopeId: "cat_1",
			});
			// Should include "all" scope + matching "category" scope
			expect(catPricing).toHaveLength(2);
		});
	});
});
