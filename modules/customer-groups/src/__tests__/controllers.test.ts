import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CustomerGroupController } from "../service";
import { createCustomerGroupControllers } from "../service-impl";

describe("customer-groups controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: CustomerGroupController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerGroupControllers(mockData);
	});

	// ── Helper ──────────────────────────────────────────────────────

	async function createTestGroup(
		overrides: Partial<Parameters<typeof controller.createGroup>[0]> = {},
	) {
		return controller.createGroup({
			name: "Test Group",
			slug: "test-group",
			...overrides,
		});
	}

	// ── Group CRUD edge cases ───────────────────────────────────────

	describe("createGroup — defaults and field handling", () => {
		it("sets metadata to empty object by default", async () => {
			const group = await createTestGroup();
			expect(group.metadata).toEqual({});
		});

		it("generates unique IDs for multiple groups", async () => {
			const g1 = await createTestGroup({ slug: "a" });
			const g2 = await createTestGroup({ slug: "b" });
			const g3 = await createTestGroup({ slug: "c" });
			expect(new Set([g1.id, g2.id, g3.id]).size).toBe(3);
		});

		it("createdAt and updatedAt are the same on creation", async () => {
			const group = await createTestGroup();
			expect(group.createdAt.getTime()).toBe(group.updatedAt.getTime());
		});

		it("creates group with priority 0 by default", async () => {
			const group = await createTestGroup();
			expect(group.priority).toBe(0);
		});
	});

	describe("getGroup — nonexistent and after delete", () => {
		it("returns null after group is deleted", async () => {
			const group = await createTestGroup();
			expect(await controller.getGroup(group.id)).not.toBeNull();
			await controller.deleteGroup(group.id);
			expect(await controller.getGroup(group.id)).toBeNull();
		});
	});

	describe("getGroupBySlug — after slug update", () => {
		it("returns null for old slug after slug is changed", async () => {
			const group = await createTestGroup({ slug: "original-slug" });
			await controller.updateGroup(group.id, { slug: "new-slug" });

			const byOld = await controller.getGroupBySlug("original-slug");
			const byNew = await controller.getGroupBySlug("new-slug");
			expect(byOld).toBeNull();
			expect(byNew?.id).toBe(group.id);
		});

		it("returns null when no groups exist", async () => {
			expect(await controller.getGroupBySlug("anything")).toBeNull();
		});
	});

	describe("updateGroup — partial updates", () => {
		it("preserves unchanged fields on partial update", async () => {
			const group = await createTestGroup({
				name: "Original",
				slug: "original",
				description: "Original description",
				type: "manual",
				priority: 5,
			});

			const updated = await controller.updateGroup(group.id, {
				name: "Updated",
			});

			expect(updated.name).toBe("Updated");
			expect(updated.slug).toBe("original");
			expect(updated.description).toBe("Original description");
			expect(updated.type).toBe("manual");
			expect(updated.priority).toBe(5);
			expect(updated.isActive).toBe(true);
		});

		it("updates updatedAt but preserves createdAt", async () => {
			const group = await createTestGroup();
			// Small delay to ensure timestamps differ
			const updated = await controller.updateGroup(group.id, {
				name: "Changed",
			});

			expect(updated.createdAt.getTime()).toBe(group.createdAt.getTime());
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				group.updatedAt.getTime(),
			);
		});

		it("changes type from manual to automatic", async () => {
			const group = await createTestGroup({ type: "manual" });
			const updated = await controller.updateGroup(group.id, {
				type: "automatic",
			});
			expect(updated.type).toBe("automatic");
		});
	});

	describe("listGroups — combined filters", () => {
		it("filters by type and activeOnly simultaneously", async () => {
			await createTestGroup({
				slug: "active-manual",
				type: "manual",
			});
			const inactiveManual = await createTestGroup({
				slug: "inactive-manual",
				type: "manual",
			});
			await controller.updateGroup(inactiveManual.id, { isActive: false });
			await createTestGroup({
				slug: "active-auto",
				type: "automatic",
			});

			const activeManual = await controller.listGroups({
				type: "manual",
				activeOnly: true,
			});
			expect(activeManual).toHaveLength(1);
			expect(activeManual[0]?.slug).toBe("active-manual");
		});

		it("returns empty array when no groups match filters", async () => {
			await createTestGroup({ type: "manual" });
			const autoGroups = await controller.listGroups({ type: "automatic" });
			expect(autoGroups).toHaveLength(0);
		});

		it("returns empty array when no groups exist", async () => {
			const groups = await controller.listGroups();
			expect(groups).toHaveLength(0);
		});
	});

	// ── Delete cascade verification ─────────────────────────────────

	describe("deleteGroup — cascade and isolation", () => {
		it("deleting a group does not affect memberships in other groups", async () => {
			const groupA = await createTestGroup({ slug: "group-a" });
			const groupB = await createTestGroup({ slug: "group-b" });

			await controller.addMember({
				groupId: groupA.id,
				customerId: "cust-1",
			});
			await controller.addMember({
				groupId: groupB.id,
				customerId: "cust-1",
			});

			await controller.deleteGroup(groupA.id);

			const members = await controller.listMembers(groupB.id);
			expect(members).toHaveLength(1);
			expect(members[0]?.customerId).toBe("cust-1");
		});

		it("deleting a group does not affect rules in other groups", async () => {
			const groupA = await createTestGroup({ slug: "group-a" });
			const groupB = await createTestGroup({ slug: "group-b" });

			await controller.addRule({
				groupId: groupA.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			await controller.addRule({
				groupId: groupB.id,
				field: "country",
				operator: "equals",
				value: "UK",
			});

			await controller.deleteGroup(groupA.id);

			const rules = await controller.listRules(groupB.id);
			expect(rules).toHaveLength(1);
			expect(rules[0]?.value).toBe("UK");
		});

		it("deleting a group does not affect price adjustments in other groups", async () => {
			const groupA = await createTestGroup({ slug: "group-a" });
			const groupB = await createTestGroup({ slug: "group-b" });

			await controller.setPriceAdjustment({
				groupId: groupA.id,
				adjustmentType: "percentage",
				value: 10,
			});
			await controller.setPriceAdjustment({
				groupId: groupB.id,
				adjustmentType: "percentage",
				value: 20,
			});

			await controller.deleteGroup(groupA.id);

			const adjustments = await controller.listPriceAdjustments(groupB.id);
			expect(adjustments).toHaveLength(1);
			expect(adjustments[0]?.value).toBe(20);
		});

		it("deleting a group with many associated records cleans up all", async () => {
			const group = await createTestGroup();

			// Add several memberships
			for (let i = 0; i < 10; i++) {
				await controller.addMember({
					groupId: group.id,
					customerId: `cust-${i}`,
				});
			}
			// Add several rules
			for (let i = 0; i < 5; i++) {
				await controller.addRule({
					groupId: group.id,
					field: `field-${i}`,
					operator: "equals",
					value: `val-${i}`,
				});
			}
			// Add several price adjustments
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
				scope: "product",
				scopeId: "prod-1",
			});

			await controller.deleteGroup(group.id);

			expect(await controller.getGroup(group.id)).toBeNull();
			expect(await controller.listMembers(group.id)).toHaveLength(0);
			expect(await controller.listRules(group.id)).toHaveLength(0);
			expect(await controller.listPriceAdjustments(group.id)).toHaveLength(0);
		});
	});

	// ── Membership edge cases ───────────────────────────────────────

	describe("addMember — metadata handling", () => {
		it("stores custom metadata on membership", async () => {
			const group = await createTestGroup();
			const membership = await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				metadata: { source: "import", tier: "gold" },
			});

			expect(membership.metadata).toEqual({
				source: "import",
				tier: "gold",
			});
		});

		it("defaults metadata to empty object when not provided", async () => {
			const group = await createTestGroup();
			const membership = await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			expect(membership.metadata).toEqual({});
		});
	});

	describe("removeMember — idempotency and non-existent", () => {
		it("does not throw when removing a non-existent membership", async () => {
			const group = await createTestGroup();
			await expect(
				controller.removeMember(group.id, "nonexistent-customer"),
			).resolves.toBeUndefined();
		});

		it("removing a member is idempotent", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			await controller.removeMember(group.id, "cust-1");
			await controller.removeMember(group.id, "cust-1");

			expect(await controller.isMember(group.id, "cust-1")).toBe(false);
		});
	});

	describe("listMembers — expiry edge cases", () => {
		it("includes members with future expiration date", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				expiresAt: new Date(Date.now() + 365 * 86400000),
			});

			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(1);
		});

		it("returns empty array for group with no members", async () => {
			const group = await createTestGroup();
			const members = await controller.listMembers(group.id);
			expect(members).toHaveLength(0);
		});

		it("returns empty array for nonexistent group", async () => {
			const members = await controller.listMembers("nonexistent");
			expect(members).toHaveLength(0);
		});
	});

	describe("isMember — with future expiration", () => {
		it("returns true for member with future expiresAt", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
				expiresAt: new Date(Date.now() + 86400000),
			});

			expect(await controller.isMember(group.id, "cust-1")).toBe(true);
		});
	});

	describe("getCustomerGroups — inactive groups with activeOnly=false", () => {
		it("includes inactive groups when activeOnly is false", async () => {
			const group = await createTestGroup({ slug: "inactive-group" });
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.updateGroup(group.id, { isActive: false });

			const groups = await controller.getCustomerGroups("cust-1", {
				activeOnly: false,
			});
			expect(groups).toHaveLength(1);
			expect(groups[0]?.name).toBe("Test Group");
		});

		it("returns groups sorted by priority", async () => {
			const g1 = await createTestGroup({ slug: "high-pri", priority: 10 });
			const g2 = await createTestGroup({ slug: "low-pri", priority: 1 });
			const g3 = await createTestGroup({ slug: "mid-pri", priority: 5 });

			await controller.addMember({ groupId: g1.id, customerId: "cust-1" });
			await controller.addMember({ groupId: g2.id, customerId: "cust-1" });
			await controller.addMember({ groupId: g3.id, customerId: "cust-1" });

			const groups = await controller.getCustomerGroups("cust-1");
			expect(groups[0]?.priority).toBe(1);
			expect(groups[1]?.priority).toBe(5);
			expect(groups[2]?.priority).toBe(10);
		});

		it("returns empty array for customer with no memberships", async () => {
			const groups = await controller.getCustomerGroups("nonexistent-cust");
			expect(groups).toHaveLength(0);
		});
	});

	// ── Bulk operations edge cases ──────────────────────────────────

	describe("bulkAddMembers — with expiresAt", () => {
		it("members added via bulk have correct expiresAt", async () => {
			const group = await createTestGroup();
			const expires = new Date(Date.now() + 86400000);
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2"], {
				expiresAt: expires,
			});

			const members = await controller.listMembers(group.id, {
				includeExpired: true,
			});
			for (const m of members) {
				expect(m.expiresAt).toEqual(expires);
			}
		});

		it("members added via bulk without expiresAt have no expiry", async () => {
			const group = await createTestGroup();
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2"]);

			const members = await controller.listMembers(group.id);
			for (const m of members) {
				expect(m.expiresAt).toBeUndefined();
			}
		});
	});

	describe("bulkRemoveMembers — partial matches", () => {
		it("only removes members that actually exist in the group", async () => {
			const group = await createTestGroup();
			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2", "cust-3"]);

			const removed = await controller.bulkRemoveMembers(group.id, [
				"cust-1",
				"nonexistent",
				"cust-3",
			]);
			expect(removed).toBe(2);

			const remaining = await controller.listMembers(group.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.customerId).toBe("cust-2");
		});

		it("does not affect memberships in other groups", async () => {
			const groupA = await createTestGroup({ slug: "group-a" });
			const groupB = await createTestGroup({ slug: "group-b" });

			await controller.bulkAddMembers(groupA.id, ["cust-1", "cust-2"]);
			await controller.bulkAddMembers(groupB.id, ["cust-1", "cust-2"]);

			await controller.bulkRemoveMembers(groupA.id, ["cust-1", "cust-2"]);

			expect(await controller.listMembers(groupA.id)).toHaveLength(0);
			expect(await controller.listMembers(groupB.id)).toHaveLength(2);
		});
	});

	// ── Re-adding member after removal ──────────────────────────────

	describe("membership lifecycle", () => {
		it("can re-add a member after removal", async () => {
			const group = await createTestGroup();

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			await controller.removeMember(group.id, "cust-1");
			expect(await controller.isMember(group.id, "cust-1")).toBe(false);

			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			expect(await controller.isMember(group.id, "cust-1")).toBe(true);
		});

		it("can re-add via bulk after removal", async () => {
			const group = await createTestGroup();

			await controller.bulkAddMembers(group.id, ["cust-1", "cust-2"]);
			await controller.bulkRemoveMembers(group.id, ["cust-1", "cust-2"]);
			expect(await controller.listMembers(group.id)).toHaveLength(0);

			const added = await controller.bulkAddMembers(group.id, [
				"cust-1",
				"cust-2",
			]);
			expect(added).toBe(2);
			expect(await controller.listMembers(group.id)).toHaveLength(2);
		});
	});

	// ── Rules edge cases ────────────────────────────────────────────

	describe("rules — multiple rules on same group", () => {
		it("generates unique IDs for multiple rules", async () => {
			const group = await createTestGroup({ type: "automatic" });

			const r1 = await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			const r2 = await controller.addRule({
				groupId: group.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});
			const r3 = await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@corp.com",
			});

			expect(new Set([r1.id, r2.id, r3.id]).size).toBe(3);
		});

		it("removeRule only removes the specified rule", async () => {
			const group = await createTestGroup({ type: "automatic" });

			const r1 = await controller.addRule({
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

			await controller.removeRule(r1.id);

			const remaining = await controller.listRules(group.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.field).toBe("totalSpent");
		});

		it("returns empty array for group with no rules", async () => {
			const group = await createTestGroup();
			const rules = await controller.listRules(group.id);
			expect(rules).toHaveLength(0);
		});
	});

	// ── evaluateRules — complex scenarios ────────────────────────────

	describe("evaluateRules — complex scenarios", () => {
		it("matches customer against multiple automatic groups", async () => {
			const g1 = await createTestGroup({
				slug: "us-customers",
				type: "automatic",
			});
			const g2 = await createTestGroup({
				slug: "high-spenders",
				type: "automatic",
			});
			const g3 = await createTestGroup({
				slug: "eu-customers",
				type: "automatic",
			});

			await controller.addRule({
				groupId: g1.id,
				field: "country",
				operator: "equals",
				value: "US",
			});
			await controller.addRule({
				groupId: g2.id,
				field: "totalSpent",
				operator: "greater_than",
				value: "1000",
			});
			await controller.addRule({
				groupId: g3.id,
				field: "country",
				operator: "in",
				value: "DE, FR, IT",
			});

			const matches = await controller.evaluateRules({
				country: "US",
				totalSpent: 1500,
			});

			expect(matches).toContain(g1.id);
			expect(matches).toContain(g2.id);
			expect(matches).not.toContain(g3.id);
		});

		it("returns empty array when no automatic groups exist", async () => {
			await createTestGroup({ type: "manual" });
			const matches = await controller.evaluateRules({ country: "US" });
			expect(matches).toHaveLength(0);
		});

		it("handles null/undefined field values gracefully with contains", async () => {
			const group = await createTestGroup({
				slug: "with-email",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@test.com",
			});

			// Undefined field value — contains on "undefined" string
			const matches = await controller.evaluateRules({});
			expect(matches).not.toContain(group.id);
		});

		it("handles case-insensitive contains matching", async () => {
			const group = await createTestGroup({
				slug: "case-test",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "contains",
				value: "@CORP.COM",
			});

			const matches = await controller.evaluateRules({
				email: "user@corp.com",
			});
			expect(matches).toContain(group.id);
		});

		it("handles case-insensitive not_contains matching", async () => {
			const group = await createTestGroup({
				slug: "case-not-contains",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "email",
				operator: "not_contains",
				value: "@CORP.COM",
			});

			// Should NOT match because corp.com contains @CORP.COM case-insensitively
			const noMatch = await controller.evaluateRules({
				email: "user@Corp.Com",
			});
			expect(noMatch).not.toContain(group.id);

			// Should match because gmail.com does not contain @CORP.COM
			const match = await controller.evaluateRules({
				email: "user@gmail.com",
			});
			expect(match).toContain(group.id);
		});

		it("in operator handles whitespace in values", async () => {
			const group = await createTestGroup({
				slug: "whitespace-in",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "in",
				value: "US,  CA , UK",
			});

			expect(await controller.evaluateRules({ country: "CA" })).toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ country: "UK" })).toContain(
				group.id,
			);
		});

		it("equals operator compares string representations", async () => {
			const group = await createTestGroup({
				slug: "string-equals",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "orderCount",
				operator: "equals",
				value: "5",
			});

			// Number 5 should match string "5"
			expect(await controller.evaluateRules({ orderCount: 5 })).toContain(
				group.id,
			);
		});

		it("greater_than and less_than use numeric comparison", async () => {
			const group = await createTestGroup({
				slug: "numeric-test",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "score",
				operator: "greater_than",
				value: "10",
			});

			expect(await controller.evaluateRules({ score: 11 })).toContain(group.id);
			expect(await controller.evaluateRules({ score: 10 })).not.toContain(
				group.id,
			);
			expect(await controller.evaluateRules({ score: 9 })).not.toContain(
				group.id,
			);
		});
	});

	// ── Price adjustments edge cases ────────────────────────────────

	describe("setPriceAdjustment — upsert behavior", () => {
		it("creates separate adjustments for different scopes", async () => {
			const group = await createTestGroup();

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
				scope: "product",
				scopeId: "prod-1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 3,
				scope: "category",
				scopeId: "cat-1",
			});

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(3);
		});

		it("upserts when scope and scopeId match", async () => {
			const group = await createTestGroup();

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "product",
				scopeId: "prod-1",
			});
			const updated = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 20,
				scope: "product",
				scopeId: "prod-1",
			});

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(1);
			expect(adjustments[0]?.adjustmentType).toBe("percentage");
			expect(adjustments[0]?.value).toBe(20);
			expect(updated.id).toBeDefined();
		});

		it("creates separate adjustments for different scopeIds on same scope", async () => {
			const group = await createTestGroup();

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "product",
				scopeId: "prod-1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 10,
				scope: "product",
				scopeId: "prod-2",
			});

			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(2);
		});

		it("preserves createdAt on upsert", async () => {
			const group = await createTestGroup();

			const first = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			const second = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 20,
			});

			expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
			expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(
				first.updatedAt.getTime(),
			);
		});
	});

	describe("removePriceAdjustment — isolation", () => {
		it("removing one adjustment does not affect others in same group", async () => {
			const group = await createTestGroup();

			const adj1 = await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
				scope: "all",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "product",
				scopeId: "prod-1",
			});

			await controller.removePriceAdjustment(adj1.id);

			const remaining = await controller.listPriceAdjustments(group.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.scope).toBe("product");
		});
	});

	describe("listPriceAdjustments — empty and nonexistent", () => {
		it("returns empty array for group with no adjustments", async () => {
			const group = await createTestGroup();
			const adjustments = await controller.listPriceAdjustments(group.id);
			expect(adjustments).toHaveLength(0);
		});

		it("returns empty array for nonexistent group", async () => {
			const adjustments = await controller.listPriceAdjustments("nonexistent");
			expect(adjustments).toHaveLength(0);
		});
	});

	// ── getCustomerPricing — scope filtering ────────────────────────

	describe("getCustomerPricing — scope filtering", () => {
		it("returns all adjustments when no scope filter is specified", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
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
				scope: "product",
				scopeId: "prod-1",
			});

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(2);
		});

		it("filters by scope when specified", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
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
				scope: "product",
				scopeId: "prod-1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 3,
				scope: "category",
				scopeId: "cat-1",
			});

			// scope=product should return "all" scope + "product" scope
			const productPricing = await controller.getCustomerPricing("cust-1", {
				scope: "product",
			});
			// "all" scope adjustments always pass (adj.scope === "all" matches),
			// "product" scope matches, "category" is filtered out
			expect(productPricing).toHaveLength(2);
		});

		it("filters by scopeId when specified", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 5,
				scope: "product",
				scopeId: "prod-1",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "fixed",
				value: 10,
				scope: "product",
				scopeId: "prod-2",
			});
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 15,
				scope: "all",
			});

			const pricing = await controller.getCustomerPricing("cust-1", {
				scopeId: "prod-1",
			});
			// "all" scope has no scopeId so passes scopeId check,
			// "product/prod-1" matches, "product/prod-2" is filtered out
			expect(pricing).toHaveLength(2);
		});

		it("aggregates pricing from multiple groups", async () => {
			const g1 = await createTestGroup({ slug: "vip" });
			const g2 = await createTestGroup({ slug: "wholesale" });

			await controller.addMember({ groupId: g1.id, customerId: "cust-1" });
			await controller.addMember({ groupId: g2.id, customerId: "cust-1" });

			await controller.setPriceAdjustment({
				groupId: g1.id,
				adjustmentType: "percentage",
				value: 5,
			});
			await controller.setPriceAdjustment({
				groupId: g1.id,
				adjustmentType: "fixed",
				value: 2,
				scope: "product",
				scopeId: "prod-1",
			});
			await controller.setPriceAdjustment({
				groupId: g2.id,
				adjustmentType: "percentage",
				value: 15,
			});

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(3);
		});

		it("returns empty array for customer with no groups", async () => {
			const pricing = await controller.getCustomerPricing("nonexistent");
			expect(pricing).toHaveLength(0);
		});
	});

	// ── Stats edge cases ────────────────────────────────────────────

	describe("getStats — after operations", () => {
		it("stats reflect state after deletions", async () => {
			const g1 = await createTestGroup({ slug: "g1", type: "manual" });
			const g2 = await createTestGroup({ slug: "g2", type: "automatic" });

			await controller.addMember({ groupId: g1.id, customerId: "cust-1" });
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

			let stats = await controller.getStats();
			expect(stats.totalGroups).toBe(2);
			expect(stats.totalMemberships).toBe(1);
			expect(stats.totalRules).toBe(1);
			expect(stats.totalPriceAdjustments).toBe(1);

			await controller.deleteGroup(g1.id);

			stats = await controller.getStats();
			expect(stats.totalGroups).toBe(1);
			expect(stats.activeGroups).toBe(1);
			expect(stats.manualGroups).toBe(0);
			expect(stats.automaticGroups).toBe(1);
			expect(stats.totalMemberships).toBe(0);
			expect(stats.totalPriceAdjustments).toBe(0);
			expect(stats.totalRules).toBe(1);
		});

		it("stats after creating, deactivating, and deleting", async () => {
			const g1 = await createTestGroup({
				slug: "active",
				type: "manual",
			});
			await createTestGroup({
				slug: "auto",
				type: "automatic",
			});

			await controller.updateGroup(g1.id, { isActive: false });

			let stats = await controller.getStats();
			expect(stats.totalGroups).toBe(2);
			expect(stats.activeGroups).toBe(1);
			expect(stats.manualGroups).toBe(1);
			expect(stats.automaticGroups).toBe(1);

			await controller.deleteGroup(g1.id);

			stats = await controller.getStats();
			expect(stats.totalGroups).toBe(1);
			expect(stats.activeGroups).toBe(1);
			expect(stats.manualGroups).toBe(0);
			expect(stats.automaticGroups).toBe(1);
		});
	});

	// ── Cross-method interaction edge cases ──────────────────────────

	describe("cross-method interactions", () => {
		it("updating group name does not break membership lookups", async () => {
			const group = await createTestGroup();
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});

			await controller.updateGroup(group.id, { name: "Renamed" });

			expect(await controller.isMember(group.id, "cust-1")).toBe(true);
			const groups = await controller.getCustomerGroups("cust-1");
			expect(groups[0]?.name).toBe("Renamed");
		});

		it("deactivating a group excludes it from evaluateRules", async () => {
			const group = await createTestGroup({
				slug: "auto-deactivate",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			let matches = await controller.evaluateRules({ country: "US" });
			expect(matches).toContain(group.id);

			await controller.updateGroup(group.id, { isActive: false });

			matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);
		});

		it("reactivating a group includes it in evaluateRules again", async () => {
			const group = await createTestGroup({
				slug: "auto-reactivate",
				type: "automatic",
			});
			await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			await controller.updateGroup(group.id, { isActive: false });
			let matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);

			await controller.updateGroup(group.id, { isActive: true });
			matches = await controller.evaluateRules({ country: "US" });
			expect(matches).toContain(group.id);
		});

		it("pricing follows membership lifecycle", async () => {
			const group = await createTestGroup();
			await controller.setPriceAdjustment({
				groupId: group.id,
				adjustmentType: "percentage",
				value: 10,
			});

			// No membership yet
			let pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(0);

			// Add membership
			await controller.addMember({
				groupId: group.id,
				customerId: "cust-1",
			});
			pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(1);

			// Remove membership
			await controller.removeMember(group.id, "cust-1");
			pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(0);
		});

		it("customer in multiple groups gets combined pricing", async () => {
			const vip = await createTestGroup({ slug: "vip", priority: 1 });
			const wholesale = await createTestGroup({
				slug: "wholesale",
				priority: 2,
			});

			await controller.addMember({ groupId: vip.id, customerId: "cust-1" });
			await controller.addMember({
				groupId: wholesale.id,
				customerId: "cust-1",
			});

			await controller.setPriceAdjustment({
				groupId: vip.id,
				adjustmentType: "percentage",
				value: 5,
			});
			await controller.setPriceAdjustment({
				groupId: wholesale.id,
				adjustmentType: "percentage",
				value: 15,
			});

			const pricing = await controller.getCustomerPricing("cust-1");
			expect(pricing).toHaveLength(2);
			const values = pricing.map((p) => p.value).sort((a, b) => a - b);
			expect(values).toEqual([5, 15]);
		});

		it("removing all rules from a group makes evaluateRules skip it", async () => {
			const group = await createTestGroup({
				slug: "auto",
				type: "automatic",
			});

			const rule = await controller.addRule({
				groupId: group.id,
				field: "country",
				operator: "equals",
				value: "US",
			});

			let matches = await controller.evaluateRules({ country: "US" });
			expect(matches).toContain(group.id);

			await controller.removeRule(rule.id);

			matches = await controller.evaluateRules({ country: "US" });
			expect(matches).not.toContain(group.id);
		});
	});

	// ── Concurrent-style operations ─────────────────────────────────

	describe("concurrent-style operations", () => {
		it("handles many groups with different priorities correctly", async () => {
			const priorities = [50, 10, 30, 20, 40, 5, 15, 25, 35, 45];
			for (let i = 0; i < priorities.length; i++) {
				await createTestGroup({
					slug: `group-${i}`,
					priority: priorities[i],
				});
			}

			const groups = await controller.listGroups();
			expect(groups).toHaveLength(10);

			// Verify sorted by priority
			for (let i = 1; i < groups.length; i++) {
				const prev = groups[i - 1];
				const curr = groups[i];
				if (prev && curr) {
					expect(prev.priority).toBeLessThanOrEqual(curr.priority);
				}
			}
		});

		it("handles a customer being a member of many groups", async () => {
			const groupIds: string[] = [];
			for (let i = 0; i < 10; i++) {
				const group = await createTestGroup({
					slug: `many-group-${i}`,
					priority: i,
				});
				groupIds.push(group.id);
			}

			for (const gid of groupIds) {
				await controller.addMember({
					groupId: gid,
					customerId: "busy-customer",
				});
			}

			const groups = await controller.getCustomerGroups("busy-customer");
			expect(groups).toHaveLength(10);
			expect(groups[0]?.priority).toBe(0);
			expect(groups[9]?.priority).toBe(9);
		});
	});
});
