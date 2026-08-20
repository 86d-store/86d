import { describe, expect, it, vi } from "vitest";
import { addMember } from "../admin/endpoints/add-member";
import { addRule } from "../admin/endpoints/add-rule";
import { bulkAddMembers } from "../admin/endpoints/bulk-add-members";
import { bulkRemoveMembers } from "../admin/endpoints/bulk-remove-members";
import { createGroup } from "../admin/endpoints/create-group";
import { deleteGroup } from "../admin/endpoints/delete-group";
import { evaluateRules } from "../admin/endpoints/evaluate-rules";
import { getGroup } from "../admin/endpoints/get-group";
import { listGroups } from "../admin/endpoints/list-groups";
import { listMembers } from "../admin/endpoints/list-members";
import { listPricing } from "../admin/endpoints/list-pricing";
import { removeMember } from "../admin/endpoints/remove-member";
import { removePricing } from "../admin/endpoints/remove-pricing";
import { removeRule } from "../admin/endpoints/remove-rule";
import { setPricing } from "../admin/endpoints/set-pricing";
import { getStats } from "../admin/endpoints/stats";
import { updateGroup } from "../admin/endpoints/update-group";
import type {
	CustomerGroup,
	CustomerGroupController,
	GroupMembership,
	GroupPriceAdjustment,
	GroupRule,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeGroup(overrides: Partial<CustomerGroup> = {}): CustomerGroup {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "VIP",
		slug: "vip",
		type: "manual",
		isActive: true,
		priority: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMembership(
	overrides: Partial<GroupMembership> = {},
): GroupMembership {
	return {
		id: crypto.randomUUID(),
		groupId: "g1",
		customerId: "c1",
		joinedAt: new Date(),
		...overrides,
	};
}

function makeRule(overrides: Partial<GroupRule> = {}): GroupRule {
	return {
		id: crypto.randomUUID(),
		groupId: "g1",
		field: "totalSpent",
		operator: "greater_than",
		value: "1000",
		createdAt: new Date(),
		...overrides,
	};
}

function makeAdjustment(
	overrides: Partial<GroupPriceAdjustment> = {},
): GroupPriceAdjustment {
	return {
		id: crypto.randomUUID(),
		groupId: "g1",
		adjustmentType: "percentage",
		value: -10,
		scope: "all",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<CustomerGroupController> = {},
): CustomerGroupController {
	return {
		createGroup: vi.fn().mockResolvedValue(makeGroup()),
		getGroup: vi.fn().mockResolvedValue(null),
		getGroupBySlug: vi.fn().mockResolvedValue(null),
		listGroups: vi.fn().mockResolvedValue([]),
		updateGroup: vi.fn().mockResolvedValue(makeGroup()),
		deleteGroup: vi.fn().mockResolvedValue(undefined),
		addMember: vi.fn().mockResolvedValue(makeMembership()),
		removeMember: vi.fn().mockResolvedValue(undefined),
		listMembers: vi.fn().mockResolvedValue([]),
		getCustomerGroups: vi.fn().mockResolvedValue([]),
		isMember: vi.fn().mockResolvedValue(false),
		bulkAddMembers: vi.fn().mockResolvedValue(0),
		bulkRemoveMembers: vi.fn().mockResolvedValue(0),
		addRule: vi.fn().mockResolvedValue(makeRule()),
		removeRule: vi.fn().mockResolvedValue(undefined),
		listRules: vi.fn().mockResolvedValue([]),
		evaluateRules: vi.fn().mockResolvedValue([]),
		setPriceAdjustment: vi.fn().mockResolvedValue(makeAdjustment()),
		removePriceAdjustment: vi.fn().mockResolvedValue(undefined),
		listPriceAdjustments: vi.fn().mockResolvedValue([]),
		getCustomerPricing: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			totalGroups: 0,
			activeGroups: 0,
			manualGroups: 0,
			automaticGroups: 0,
			totalMemberships: 0,
			totalRules: 0,
			totalPriceAdjustments: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: CustomerGroupController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				customerGroups: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listGroupsHandler = extractHandler(listGroups);
const createGroupHandler = extractHandler(createGroup);
const getGroupHandler = extractHandler(getGroup);
const updateGroupHandler = extractHandler(updateGroup);
const deleteGroupHandler = extractHandler(deleteGroup);
const addMemberHandler = extractHandler(addMember);
const removeMemberHandler = extractHandler(removeMember);
const listMembersHandler = extractHandler(listMembers);
const bulkAddHandler = extractHandler(bulkAddMembers);
const bulkRemoveHandler = extractHandler(bulkRemoveMembers);
const addRuleHandler = extractHandler(addRule);
const removeRuleHandler = extractHandler(removeRule);
const evaluateRulesHandler = extractHandler(evaluateRules);
const setPricingHandler = extractHandler(setPricing);
const listPricingHandler = extractHandler(listPricing);
const removePricingHandler = extractHandler(removePricing);
const statsHandler = extractHandler(getStats);

// ── listGroups ────────────────────────────────────────────────────────────────

describe("admin GET /customer-groups", () => {
	it("returns empty list when no groups exist", async () => {
		const result = (await call(listGroupsHandler)) as {
			groups: CustomerGroup[];
		};
		expect(result.groups).toHaveLength(0);
	});

	it("returns groups from controller", async () => {
		const groups = [
			makeGroup({ name: "VIP" }),
			makeGroup({ name: "Wholesale" }),
		];
		const ctrl = makeController({
			listGroups: vi.fn().mockResolvedValue(groups),
		});
		const result = (await call(listGroupsHandler, {
			controller: ctrl,
		})) as { groups: CustomerGroup[] };
		expect(result.groups).toHaveLength(2);
	});

	it("forwards type filter to controller", async () => {
		const ctrl = makeController();
		await call(listGroupsHandler, {
			query: { type: "automatic" },
			controller: ctrl,
		});
		expect(ctrl.listGroups).toHaveBeenCalledWith(
			expect.objectContaining({ type: "automatic" }),
		);
	});

	it("passes activeOnly=true when flag is set", async () => {
		const ctrl = makeController();
		await call(listGroupsHandler, {
			query: { activeOnly: "true" },
			controller: ctrl,
		});
		expect(ctrl.listGroups).toHaveBeenCalledWith(
			expect.objectContaining({ activeOnly: true }),
		);
	});
});

// ── createGroup ───────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/create", () => {
	it("creates a group and returns it", async () => {
		const group = makeGroup({ name: "Gold", slug: "gold" });
		const ctrl = makeController({
			createGroup: vi.fn().mockResolvedValue(group),
		});
		const result = (await call(createGroupHandler, {
			body: { name: "Gold", slug: "gold" },
			controller: ctrl,
		})) as { group: CustomerGroup };
		expect(result.group.name).toBe("Gold");
		expect(ctrl.createGroup).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Gold", slug: "gold" }),
		);
	});
});

// ── getGroup ──────────────────────────────────────────────────────────────────

describe("admin GET /customer-groups/:id", () => {
	it("returns 404 when group not found", async () => {
		const result = (await call(getGroupHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer group not found");
	});

	it("returns group when found", async () => {
		const group = makeGroup({ id: "g1" });
		const ctrl = makeController({ getGroup: vi.fn().mockResolvedValue(group) });
		const result = (await call(getGroupHandler, {
			params: { id: "g1" },
			controller: ctrl,
		})) as { group: CustomerGroup };
		expect(result.group.id).toBe("g1");
	});
});

// ── updateGroup ───────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/update", () => {
	it("updates group and returns it", async () => {
		const group = makeGroup({ id: "g2", isActive: false });
		const ctrl = makeController({
			updateGroup: vi.fn().mockResolvedValue(group),
		});
		const result = (await call(updateGroupHandler, {
			params: { id: "g2" },
			body: { isActive: false },
			controller: ctrl,
		})) as { group: CustomerGroup };
		expect(result.group.isActive).toBe(false);
		expect(ctrl.updateGroup).toHaveBeenCalledWith(
			"g2",
			expect.objectContaining({ isActive: false }),
		);
	});
});

// ── deleteGroup ───────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/delete", () => {
	it("deletes group and returns success", async () => {
		const ctrl = makeController({
			deleteGroup: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteGroupHandler, {
			params: { id: "g3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteGroup).toHaveBeenCalledWith("g3");
	});
});

// ── addMember ─────────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/members/add", () => {
	it("adds member and returns membership", async () => {
		const membership = makeMembership({ groupId: "g1", customerId: "c1" });
		const ctrl = makeController({
			addMember: vi.fn().mockResolvedValue(membership),
		});
		const result = (await call(addMemberHandler, {
			params: { id: "g1" },
			body: { customerId: "c1" },
			controller: ctrl,
		})) as { membership: GroupMembership };
		expect(result.membership.customerId).toBe("c1");
		expect(ctrl.addMember).toHaveBeenCalledWith(
			expect.objectContaining({ groupId: "g1", customerId: "c1" }),
		);
	});
});

// ── removeMember ──────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/members/remove", () => {
	it("removes member and returns success", async () => {
		const ctrl = makeController({
			removeMember: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(removeMemberHandler, {
			params: { id: "g1" },
			body: { customerId: "c2" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removeMember).toHaveBeenCalledWith("g1", "c2");
	});
});

// ── listMembers ───────────────────────────────────────────────────────────────

describe("admin GET /customer-groups/:id/members", () => {
	it("returns empty list when group has no members", async () => {
		const result = (await call(listMembersHandler, {
			params: { id: "g1" },
		})) as { members: GroupMembership[] };
		expect(result.members).toHaveLength(0);
	});

	it("returns members from controller", async () => {
		const members = [makeMembership(), makeMembership()];
		const ctrl = makeController({
			listMembers: vi.fn().mockResolvedValue(members),
		});
		const result = (await call(listMembersHandler, {
			params: { id: "g1" },
			controller: ctrl,
		})) as { members: GroupMembership[] };
		expect(result.members).toHaveLength(2);
	});

	it("passes includeExpired flag to controller", async () => {
		const ctrl = makeController();
		await call(listMembersHandler, {
			params: { id: "g1" },
			query: { includeExpired: "true" },
			controller: ctrl,
		});
		expect(ctrl.listMembers).toHaveBeenCalledWith(
			"g1",
			expect.objectContaining({ includeExpired: true }),
		);
	});
});

// ── bulkAddMembers ────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/members/bulk-add", () => {
	it("adds multiple members and returns count", async () => {
		const ctrl = makeController({
			bulkAddMembers: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkAddHandler, {
			params: { id: "g1" },
			body: { customerIds: ["c1", "c2", "c3"] },
			controller: ctrl,
		})) as { added: number; total: number };
		expect(result.added).toBe(3);
		expect(result.total).toBe(3);
		expect(ctrl.bulkAddMembers).toHaveBeenCalledWith(
			"g1",
			["c1", "c2", "c3"],
			{},
		);
	});
});

// ── bulkRemoveMembers ─────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/members/bulk-remove", () => {
	it("removes multiple members and returns count", async () => {
		const ctrl = makeController({
			bulkRemoveMembers: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(bulkRemoveHandler, {
			params: { id: "g1" },
			body: { customerIds: ["c1", "c2"] },
			controller: ctrl,
		})) as { removed: number; total: number };
		expect(result.removed).toBe(2);
		expect(result.total).toBe(2);
		expect(ctrl.bulkRemoveMembers).toHaveBeenCalledWith("g1", ["c1", "c2"]);
	});
});

// ── addRule ───────────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/rules/add", () => {
	it("adds rule and returns it", async () => {
		const rule = makeRule({
			groupId: "g1",
			field: "totalOrders",
			operator: "greater_than",
			value: "5",
		});
		const ctrl = makeController({ addRule: vi.fn().mockResolvedValue(rule) });
		const result = (await call(addRuleHandler, {
			params: { id: "g1" },
			body: { field: "totalOrders", operator: "greater_than", value: "5" },
			controller: ctrl,
		})) as { rule: GroupRule };
		expect(result.rule.field).toBe("totalOrders");
		expect(ctrl.addRule).toHaveBeenCalledWith(
			expect.objectContaining({
				groupId: "g1",
				field: "totalOrders",
				operator: "greater_than",
			}),
		);
	});
});

// ── removeRule ────────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/rules/:ruleId/remove", () => {
	it("removes rule and returns success", async () => {
		const ctrl = makeController({
			removeRule: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(removeRuleHandler, {
			params: { ruleId: "rule_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removeRule).toHaveBeenCalledWith("rule_1");
	});
});

// ── evaluateRules ─────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/evaluate", () => {
	it("returns matching group IDs for customer data", async () => {
		const ctrl = makeController({
			evaluateRules: vi.fn().mockResolvedValue(["g1", "g2"]),
		});
		const result = (await call(evaluateRulesHandler, {
			body: { customerData: { totalSpent: 5000, totalOrders: 12 } },
			controller: ctrl,
		})) as { matchingGroupIds: string[] };
		expect(result.matchingGroupIds).toEqual(["g1", "g2"]);
		expect(ctrl.evaluateRules).toHaveBeenCalledWith({
			totalSpent: 5000,
			totalOrders: 12,
		});
	});

	it("returns empty array when no rules match", async () => {
		const result = (await call(evaluateRulesHandler, {
			body: { customerData: {} },
		})) as { matchingGroupIds: string[] };
		expect(result.matchingGroupIds).toHaveLength(0);
	});
});

// ── setPricing ────────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/:id/pricing", () => {
	it("sets price adjustment and returns it", async () => {
		const adj = makeAdjustment({ groupId: "g1", value: -15 });
		const ctrl = makeController({
			setPriceAdjustment: vi.fn().mockResolvedValue(adj),
		});
		const result = (await call(setPricingHandler, {
			params: { id: "g1" },
			body: { adjustmentType: "percentage", value: -15 },
			controller: ctrl,
		})) as { adjustment: GroupPriceAdjustment };
		expect(result.adjustment.value).toBe(-15);
		expect(ctrl.setPriceAdjustment).toHaveBeenCalledWith(
			expect.objectContaining({ groupId: "g1", value: -15 }),
		);
	});
});

// ── listPricing ───────────────────────────────────────────────────────────────

describe("admin GET /customer-groups/:id/pricing/list", () => {
	it("returns empty list when no adjustments set", async () => {
		const result = (await call(listPricingHandler, {
			params: { id: "g1" },
		})) as { adjustments: GroupPriceAdjustment[] };
		expect(result.adjustments).toHaveLength(0);
	});

	it("returns adjustments from controller", async () => {
		const adjs = [makeAdjustment(), makeAdjustment()];
		const ctrl = makeController({
			listPriceAdjustments: vi.fn().mockResolvedValue(adjs),
		});
		const result = (await call(listPricingHandler, {
			params: { id: "g1" },
			controller: ctrl,
		})) as { adjustments: GroupPriceAdjustment[] };
		expect(result.adjustments).toHaveLength(2);
		expect(ctrl.listPriceAdjustments).toHaveBeenCalledWith("g1");
	});
});

// ── removePricing ─────────────────────────────────────────────────────────────

describe("admin POST /customer-groups/pricing/:adjustmentId/remove", () => {
	it("removes adjustment and returns success", async () => {
		const ctrl = makeController({
			removePriceAdjustment: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(removePricingHandler, {
			params: { adjustmentId: "adj_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removePriceAdjustment).toHaveBeenCalledWith("adj_1");
	});
});

// ── stats ─────────────────────────────────────────────────────────────────────

describe("admin GET /customer-groups/stats", () => {
	it("returns zero-state stats when no groups exist", async () => {
		const result = (await call(statsHandler)) as {
			stats: {
				totalGroups: number;
				activeGroups: number;
				totalMemberships: number;
			};
		};
		expect(result.stats.totalGroups).toBe(0);
		expect(result.stats.activeGroups).toBe(0);
		expect(result.stats.totalMemberships).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalGroups: 5,
				activeGroups: 4,
				manualGroups: 3,
				automaticGroups: 2,
				totalMemberships: 127,
				totalRules: 8,
				totalPriceAdjustments: 12,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: { totalGroups: number; totalMemberships: number };
		};
		expect(result.stats.totalGroups).toBe(5);
		expect(result.stats.totalMemberships).toBe(127);
	});
});
