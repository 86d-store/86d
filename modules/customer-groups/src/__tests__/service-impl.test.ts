import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CustomerGroupController } from "../service";
import { createCustomerGroupControllers } from "../service-impl";

describe("Customer Groups Module", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: CustomerGroupController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerGroupControllers(mockData);
	});

	// ─── Group CRUD ───

	describe("createGroup", () => {
		it("creates a group with all fields", async () => {
			const group = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
				description: "Wholesale customers with bulk pricing",
				type: "manual",
				priority: 1,
			});

			expect(group.id).toBeDefined();
			expect(group.name).toBe("Wholesale");
			expect(group.slug).toBe("wholesale");
			expect(group.description).toBe("Wholesale customers with bulk pricing");
			expect(group.type).toBe("manual");
			expect(group.isActive).toBe(true);
			expect(group.priority).toBe(1);
			expect(group.createdAt).toBeInstanceOf(Date);
			expect(group.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a group with defaults", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			expect(group.type).toBe("manual");
			expect(group.priority).toBe(0);
			expect(group.isActive).toBe(true);
			expect(group.description).toBeUndefined();
		});

		it("creates an automatic group", async () => {
			const group = await controller.createGroup({
				name: "High Spenders",
				slug: "high-spenders",
				type: "automatic",
			});

			expect(group.type).toBe("automatic");
		});
	});

	describe("getGroup", () => {
		it("returns a group by ID", async () => {
			const created = await controller.createGroup({
				name: "Retail",
				slug: "retail",
			});

			const found = await controller.getGroup(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Retail");
		});

		it("returns null for nonexistent ID", async () => {
			const found = await controller.getGroup("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("getGroupBySlug", () => {
		it("returns a group by slug", async () => {
			await controller.createGroup({
				name: "Employee",
				slug: "employee",
			});

			const found = await controller.getGroupBySlug("employee");
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Employee");
		});

		it("returns null for nonexistent slug", async () => {
			const found = await controller.getGroupBySlug("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listGroups", () => {
		it("lists all groups sorted by priority", async () => {
			await controller.createGroup({
				name: "Low",
				slug: "low",
				priority: 3,
			});
			await controller.createGroup({
				name: "High",
				slug: "high",
				priority: 1,
			});
			await controller.createGroup({
				name: "Mid",
				slug: "mid",
				priority: 2,
			});

			const groups = await controller.listGroups();
			expect(groups).toHaveLength(3);
			expect(groups[0].name).toBe("High");
			expect(groups[1].name).toBe("Mid");
			expect(groups[2].name).toBe("Low");
		});

		it("filters by type", async () => {
			await controller.createGroup({
				name: "Manual",
				slug: "manual",
				type: "manual",
			});
			await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});

			const manual = await controller.listGroups({ type: "manual" });
			expect(manual).toHaveLength(1);
			expect(manual[0].name).toBe("Manual");

			const auto = await controller.listGroups({ type: "automatic" });
			expect(auto).toHaveLength(1);
			expect(auto[0].name).toBe("Auto");
		});

		it("filters active only", async () => {
			const group = await controller.createGroup({
				name: "Active",
				slug: "active",
			});
			await controller.createGroup({
				name: "Inactive",
				slug: "inactive",
			});
			await controller.updateGroup(group.id, { isActive: true });

			const inactive = await controller.listGroups();
			// Both groups should appear without activeOnly
			expect(inactive.length).toBeGreaterThanOrEqual(2);

			// Deactivate one
			const all = await controller.listGroups();
			const secondGroup = all.find((g) => g.name === "Inactive");
			if (secondGroup) {
				await controller.updateGroup(secondGroup.id, { isActive: false });
			}

			const activeOnly = await controller.listGroups({ activeOnly: true });
			expect(activeOnly).toHaveLength(1);
			expect(activeOnly[0].name).toBe("Active");
		});
	});

	describe("updateGroup", () => {
		it("updates group fields", async () => {
			const group = await controller.createGroup({
				name: "Old Name",
				slug: "old-name",
				priority: 0,
			});

			const updated = await controller.updateGroup(group.id, {
				name: "New Name",
				slug: "new-name",
				priority: 5,
				description: "Updated description",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.slug).toBe("new-name");
			expect(updated.priority).toBe(5);
			expect(updated.description).toBe("Updated description");
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				group.updatedAt.getTime(),
			);
		});

		it("deactivates a group", async () => {
			const group = await controller.createGroup({
				name: "Group",
				slug: "group",
			});

			const updated = await controller.updateGroup(group.id, {
				isActive: false,
			});
			expect(updated.isActive).toBe(false);
		});

		it("throws for nonexistent group", async () => {
			await expect(
				controller.updateGroup("bad-id", { name: "X" }),
			).rejects.toThrow("Customer group bad-id not found");
		});
	});

	describe("deleteGroup", () => {
		it("deletes a group and its associated data", async () => {
			const group = await controller.createGroup({
				name: "ToDelete",
				slug: "to-delete",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@test.com",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			await controller.deleteGroup(group.id);

			const found = await controller.getGroup(group.id);
			expect(found).toBeNull();

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(0);

			const rules = await controller.listRules(group.id);
			expect(rules).toHaveLength(0);

			const pricing = await controller.listPriceAdjustments(group.id);
			expect(pricing).toHaveLength(0);
		});
	});

	// ─── Membership ───

	describe("addMember", () => {
		it("adds a customer to a group", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			const membership = await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			expect(membership.id).toBeDefined();
			expect(membership.groupId).toBe(group.id);
			expect(membership.customerId).toBe("cust-1");
			expect(membership.joinedAt).toBeInstanceOf(Date);
			expect(membership.expiresAt).toBeUndefined();
		});

		it("adds a member with expiration", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			const expires = new Date(Date.now() + 86400000);
			const membership = await controller.addMember({
				groupId: group.id,
				customerId: "cust-2",
				expiresAt: expires,
			});

			expect(membership.expiresAt).toEqual(expires);
		});

		it("prevents duplicate membership", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			await expect(
				controller.addMember({
					groupId: group.id,
					customerId: "cust-1",
				}),
			).rejects.toThrow("already a member");
		});
	});

	describe("removeMember", () => {
		it("removes a customer from a group", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			await controller.removeMember(group.id, "cust-1");

			const isMember = await controller.isMember(group.id, "cust-1");
			expect(isMember).toBe(false);
		});
	});

	describe("listMembers", () => {
		it("lists active members", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-2",
			});

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(2);
		});

		it("excludes expired members by default", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			// Active member
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			// Expired member
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-2",
				expiresAt: new Date(Date.now() - 86400000),
			});

			const active = await controller.listMembers(group.id);
			expect(active).toHaveLength(1);
			expect(active[0].customerId).toBe("cust-1");

			const all = await controller.listMembers(group.id, {
				includeExpired: true,
			});
			expect(all).toHaveLength(2);
		});
	});

	describe("getCustomerGroups", () => {
		it("returns all groups for a customer", async () => {
			const g1 = await controller.createGroup({
				name: "VIP",
				slug: "vip",
				priority: 1,
			});
			const g2 = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
				priority: 2,
			});

			await controller.addMember({
				groupId: g1.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: g2.id,
				customerId: "cust-1",
			});

			const groups = await controller.getCustomerGroups("cust-1");
			expect(groups).toHaveLength(2);
			expect(groups[0].name).toBe("VIP");
			expect(groups[1].name).toBe("Wholesale");
		});

		it("excludes expired memberships", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				expiresAt: new Date(Date.now() - 86400000),
			});

			const groups = await controller.getCustomerGroups("cust-1");
			expect(groups).toHaveLength(0);
		});

		it("excludes inactive groups when activeOnly is true", async () => {
			const group = await controller.createGroup({
				name: "Inactive",
				slug: "inactive",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.updateGroup(group.id, { isActive: false });

			const groups = await controller.getCustomerGroups("cust-1", {
				activeOnly: true,
			});
			expect(groups).toHaveLength(0);
		});
	});

	describe("isMember", () => {
		it("returns true for active member", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			expect(await controller.isMember(group.id, "cust-1")).toBe(true);
		});

		it("returns false for non-member", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			expect(await controller.isMember(group.id, "cust-1")).toBe(false);
		});

		it("returns false for expired member", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				expiresAt: new Date(Date.now() - 86400000),
			});

			expect(await controller.isMember(group.id, "cust-1")).toBe(false);
		});
	});

	// ─── Rules ───

	describe("addRule", () => {
		it("adds a rule to a group", async () => {
			const group = await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});

			const rule = await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});

			expect(rule.id).toBeDefined();
			expect(rule.groupId).toBe(group.id);
			expect(rule.field).toBe("totalSpent");
			expect(rule.operator).toBe("greater_than");
			expect(rule.value).toBe("1000");
			expect(rule.createdAt).toBeInstanceOf(Date);
		});
	});

	describe("removeRule", () => {
		it("removes a rule", async () => {
			const group = await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});

			const rule = await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@company.com",
			});

			await controller.removeRule(rule.id);

			const rules = await controller.listRules(group.id);
			expect(rules).toHaveLength(0);
		});
	});

	describe("listRules", () => {
		it("lists rules for a group", async () => {
			const group = await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "500",
			});

			const rules = await controller.listRules(group.id);
			expect(rules).toHaveLength(2);
		});
	});

	describe("evaluateRules", () => {
		it("matches customer data against automatic group rules", async () => {
			const group = await controller.createGroup({
				name: "US High Spenders",
				slug: "us-high-spenders",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});

			const matches = await controller.evaluateRules({
				country: "US",
				totalSpent: 1500,
			});

			expect(matches).toContain(group.id);
		});

		it("requires all rules to match (AND logic)", async () => {
			const group = await controller.createGroup({
				name: "US High Spenders",
				slug: "us-high-spenders",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});

			// Country matches but spend doesn't
			const matches = await controller.evaluateRules({
				country: "US",
				totalSpent: 500,
			});

			expect(matches).not.toContain(group.id);
		});

		it("skips inactive automatic groups", async () => {
			const group = await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			await controller.updateGroup(group.id, { isActive: false });

			const matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);
		});

		it("skips manual groups", async () => {
			const group = await controller.createGroup({
				name: "Manual",
				slug: "manual",
				type: "manual",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			const matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);
		});

		it("handles contains operator", async () => {
			const group = await controller.createGroup({
				name: "Corp",
				slug: "corp",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@corp.com",
			});

			expect(
				await controller.evaluateRules({ email: "user@corp.com" }),
			).toContain(group.id);
			expect(
				await controller.evaluateRules({ email: "user@gmail.com" }),
			).not.toContain(group.id);
		});

		it("handles not_contains operator", async () => {
			const group = await controller.createGroup({
				name: "NonCorp",
				slug: "noncorp",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "not_contains",
				value: "@corp.com",
			});

			expect(
				await controller.evaluateRules({ email: "user@gmail.com" }),
			).toContain(group.id);
			expect(
				await controller.evaluateRules({ email: "user@corp.com" }),
			).not.toContain(group.id);
		});

		it("handles in operator", async () => {
			const group = await controller.createGroup({
				name: "Select Countries",
				slug: "select-countries",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "in",
				value: "US, CA, UK",
			});

			expect(await controller.evaluateRules({ country: "US" })).toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ country: "FR" })).not.toContain(
				group.id,
			);
		});

		it("handles not_in operator", async () => {
			const group = await controller.createGroup({
				name: "Excluded",
				slug: "excluded",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "not_in",
				value: "US, CA",
			});

			expect(await controller.evaluateRules({ country: "FR" })).toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ country: "US" })).not.toContain(
				group.id,
			);
		});

		it("handles less_than operator", async () => {
			const group = await controller.createGroup({
				name: "New Customers",
				slug: "new-customers",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "orderCount",
				operator: "less_than",
				value: "3",
			});

			expect(await controller.evaluateRules({ orderCount: 1 })).toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ orderCount: 5 })).not.toContain(
				group.id,
			);
		});

		it("handles not_equals operator", async () => {
			const group = await controller.createGroup({
				name: "NonGuest",
				slug: "nonguest",
				type: "automatic",
			});

			await controller.addRule({
				groupId: group.id,
				field: "role",
				operator: "not_equals",
				value: "guest",
			});

			expect(await controller.evaluateRules({ role: "member" })).toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ role: "guest" })).not.toContain(
				group.id,
			);
		});

		it("skips groups with no rules", async () => {
			const group = await controller.createGroup({
				name: "Empty",
				slug: "empty",
				type: "automatic",
			});

			const matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);
		});
	});

	// ─── Price Adjustments ───

	describe("setPriceAdjustment", () => {
		it("creates a percentage price adjustment", async () => {
			const group = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
			});

			const adj = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 15,
			});

			expect(adj.id).toBeDefined();
			expect(adj.groupId).toBe(group.id);
			expect(adj.adjustmentType).toBe("percentage");
			expect(adj.value).toBe(15);
			expect(adj.scope).toBe("all");
			expect(adj.scopeId).toBeUndefined();
		});

		it("creates a fixed price adjustment for a category", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			const adj = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "category",
				scopeId: "electronics",
			});

			expect(adj.scope).toBe("category");
			expect(adj.scopeId).toBe("electronics");
		});

		it("updates existing adjustment with same scope", async () => {
			const group = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
			});

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			const updated = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 20,
			});

			expect(updated.value).toBe(20);

			// Should still be just one adjustment
			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(1);
		});
	});

	describe("removePriceAdjustment", () => {
		it("removes a price adjustment", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});

			const adj = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			await controller.removePriceAdjustment(adj.id);

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(0);
		});
	});

	describe("listPriceAdjustments", () => {
		it("lists all adjustments for a group", async () => {
			const group = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
			});

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 15,
				scope: "all",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "category",
				scopeId: "electronics",
			});

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(2);
		});
	});

	describe("getCustomerPricing", () => {
		it("returns pricing from all customer groups", async () => {
			const g1 = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			const g2 = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
			});

			await controller.addMember({
				groupId: g1.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: g2.id,
				customerId: "cust-1",
			});

			await controller.setPriceAdjustment({
				groupId: g1.id,
				adjustmentType: "percentage",
				value: 5,
			});
			await controller.setPriceAdjustment({
				groupId: g2.id,
				adjustmentType: "percentage",
				value: 15,
			});

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(2);
		});

		it("excludes pricing from inactive groups", async () => {
			const group = await controller.createGroup({
				name: "Inactive",
				slug: "inactive",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});
			await controller.updateGroup(group.id, { isActive: false });

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(0);
		});

		it("excludes pricing from expired memberships", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				expiresAt: new Date(Date.now() - 86400000),
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(0);
		});
	});

	// ─── Bulk Operations ───

	describe("bulkAddMembers", () => {
		it("adds multiple members to a group", async () => {
			const group = await controller.createGroup({
				name: "Wholesale",
				slug: "wholesale",
			});
			const added = await controller.bulkAddMembers(group.id, [
				"cust-1",
				"cust-2",
				"cust-3",
			]);
			expect(added).toBe(3);

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(3);
		});

		it("skips already existing members", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			const added = await controller.bulkAddMembers(group.id, [
				"cust-1",
				"cust-2",
			]);
			expect(added).toBe(1); // only cust-2 was new

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(2);
		});

		it("applies expiresAt to all new members", async () => {
			const group = await controller.createGroup({
				name: "Trial",
				slug: "trial",
			});
			const expires = new Date(Date.now() + 86400000);
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2"], {
				expiresAt: expires,
			});

			const members = await controller.listMembers(group.id, {
				includeExpired: true,
			});
			expect(members[0].expiresAt).toEqual(expires);
			expect(members[1].expiresAt).toEqual(expires);
		});

		it("returns 0 for empty input", async () => {
			const group = await controller.createGroup({
				name: "Empty",
				slug: "empty",
			});
			const added = await controller.bulkAddMembers(group.id, []);
			expect(added).toBe(0);
		});

		it("returns 0 when all are duplicates", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-2",
			});

			const added = await controller.bulkAddMembers(group.id, [
				"cust-1",
				"cust-2",
			]);
			expect(added).toBe(0);
		});
	});

	describe("bulkRemoveMembers", () => {
		it("removes multiple members from a group", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2", "cust-3"]);

			const removed = await controller.bulkRemoveMembers(group.id, [
				"cust-1",
				"cust-3",
			]);
			expect(removed).toBe(2);

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(1);
		});

		it("returns 0 for non-existent members", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			const removed = await controller.bulkRemoveMembers(group.id, [
				"nonexistent-1",
				"nonexistent-2",
			]);
			expect(removed).toBe(0);
		});

		it("returns 0 for empty input", async () => {
			const group = await controller.createGroup({
				name: "Empty",
				slug: "empty",
			});
			const removed = await controller.bulkRemoveMembers(group.id, []);
			expect(removed).toBe(0);
		});

		it("handles mixed existing and non-existing members", async () => {
			const group = await controller.createGroup({
				name: "VIP",
				slug: "vip",
			});
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2"]);

			const removed = await controller.bulkRemoveMembers(group.id, [
				"cust-1",
				"nonexistent",
			]);
			expect(removed).toBe(1);
		});
	});

	// ─── Stats ───

	describe("getStats", () => {
		it("returns correct statistics", async () => {
			const g1 = await controller.createGroup({
				name: "Manual",
				slug: "manual",
				type: "manual",
			});
			const g2 = await controller.createGroup({
				name: "Auto",
				slug: "auto",
				type: "automatic",
			});
			await controller.createGroup({
				name: "Inactive",
				slug: "inactive",
				type: "manual",
			});

			// Deactivate one
			const all = await controller.listGroups();
			const inactiveGroup = all.find((g) => g.name === "Inactive");
			if (inactiveGroup) {
				await controller.updateGroup(inactiveGroup.id, {
					isActive: false,
				});
			}

			await controller.addMember({
				groupId: g1.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: g1.id,
				customerId: "cust-2",
			});

			await controller.addRule({
				groupId: g2.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			await controller.setPriceAdjustment({
				groupId: g1.id,
				adjustmentType: "percentage",
				value: 10,
			});

			const stats = await controller.getStats();
			expect(stats.totalGroups).toBe(3);
			expect(stats.activeGroups).toBe(2);
			expect(stats.manualGroups).toBe(2);
			expect(stats.automaticGroups).toBe(1);
			expect(stats.totalMemberships).toBe(2);
			expect(stats.totalRules).toBe(1);
			expect(stats.totalPriceAdjustments).toBe(1);
		});

		it("returns zeroes when no data", async () => {
			const stats = await controller.getStats();
			expect(stats.totalGroups).toBe(0);
			expect(stats.activeGroups).toBe(0);
			expect(stats.manualGroups).toBe(0);
			expect(stats.automaticGroups).toBe(0);
			expect(stats.totalMemberships).toBe(0);
			expect(stats.totalRules).toBe(0);
			expect(stats.totalPriceAdjustments).toBe(0);
		});
	});
});
