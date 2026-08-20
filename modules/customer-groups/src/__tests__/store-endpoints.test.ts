import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerGroupControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the customer-groups module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. my-groups: auth required, returns customer's group memberships
 * 2. my-pricing: auth required, returns price adjustments for customer
 * 3. check-membership: auth required, checks if customer is in a group
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateMyGroups(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createCustomerGroupControllers(data);
	const groups = await controller.getCustomerGroups(opts.customerId, {
		activeOnly: true,
	});
	return { groups };
}

async function simulateMyPricing(
	data: DataService,
	query: {
		scope?: "all" | "category" | "product";
		scopeId?: string;
	} = {},
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createCustomerGroupControllers(data);
	const pricing = await controller.getCustomerPricing(opts.customerId, {
		...(query.scope != null && { scope: query.scope }),
		...(query.scopeId != null && { scopeId: query.scopeId }),
	});
	return { pricing };
}

async function simulateCheckMembership(
	data: DataService,
	groupId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createCustomerGroupControllers(data);
	const isMember = await controller.isMember(groupId, opts.customerId);
	return { isMember };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: my groups — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyGroups(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's active group memberships", async () => {
		const ctrl = createCustomerGroupControllers(data);
		const group = await ctrl.createGroup({
			name: "VIP Customers",
			slug: "vip",
			type: "manual",
		});
		await ctrl.addMember({ groupId: group.id, customerId: "cust_1" });

		const result = await simulateMyGroups(data, { customerId: "cust_1" });

		expect("groups" in result).toBe(true);
		if ("groups" in result) {
			expect(result.groups).toHaveLength(1);
			expect(result.groups[0].name).toBe("VIP Customers");
		}
	});

	it("does not return inactive groups", async () => {
		const ctrl = createCustomerGroupControllers(data);
		const group = await ctrl.createGroup({
			name: "Archived Group",
			slug: "archived",
			type: "manual",
		});
		await ctrl.addMember({ groupId: group.id, customerId: "cust_1" });
		await ctrl.updateGroup(group.id, { isActive: false });

		const result = await simulateMyGroups(data, { customerId: "cust_1" });

		expect("groups" in result).toBe(true);
		if ("groups" in result) {
			expect(result.groups).toHaveLength(0);
		}
	});

	it("returns empty for customer with no memberships", async () => {
		const result = await simulateMyGroups(data, {
			customerId: "cust_new",
		});

		expect("groups" in result).toBe(true);
		if ("groups" in result) {
			expect(result.groups).toHaveLength(0);
		}
	});
});

describe("store endpoint: my pricing — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyPricing(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns price adjustments for customer's groups", async () => {
		const ctrl = createCustomerGroupControllers(data);
		const group = await ctrl.createGroup({
			name: "Wholesale",
			slug: "wholesale",
			type: "manual",
		});
		await ctrl.addMember({ groupId: group.id, customerId: "cust_1" });
		await ctrl.setPriceAdjustment({
			groupId: group.id,
			adjustmentType: "percentage",
			value: 20,
		});

		const result = await simulateMyPricing(data, {}, { customerId: "cust_1" });

		expect("pricing" in result).toBe(true);
		if ("pricing" in result) {
			expect(result.pricing).toHaveLength(1);
			expect(result.pricing[0].value).toBe(20);
		}
	});

	it("returns empty for customer with no group pricing", async () => {
		const result = await simulateMyPricing(
			data,
			{},
			{ customerId: "cust_new" },
		);

		expect("pricing" in result).toBe(true);
		if ("pricing" in result) {
			expect(result.pricing).toHaveLength(0);
		}
	});
});

describe("store endpoint: check membership — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCheckMembership(data, "group_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns true when customer is a member", async () => {
		const ctrl = createCustomerGroupControllers(data);
		const group = await ctrl.createGroup({
			name: "Premium",
			slug: "premium",
			type: "manual",
		});
		await ctrl.addMember({ groupId: group.id, customerId: "cust_1" });

		const result = await simulateCheckMembership(data, group.id, {
			customerId: "cust_1",
		});

		expect("isMember" in result).toBe(true);
		if ("isMember" in result) {
			expect(result.isMember).toBe(true);
		}
	});

	it("returns false when customer is not a member", async () => {
		const ctrl = createCustomerGroupControllers(data);
		const group = await ctrl.createGroup({
			name: "Exclusive",
			slug: "exclusive",
			type: "manual",
		});

		const result = await simulateCheckMembership(data, group.id, {
			customerId: "cust_1",
		});

		expect("isMember" in result).toBe(true);
		if ("isMember" in result) {
			expect(result.isMember).toBe(false);
		}
	});
});
