import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CustomerGroup,
	CustomerGroupController,
	GroupMembership,
	GroupPriceAdjustment,
	GroupRule,
	RuleOperator,
} from "./service";

function matchesRule(
	customerData: Record<string, unknown>,
	rule: GroupRule,
): boolean {
	const fieldValue = customerData[rule.field];
	const ruleValue = rule.value;

	switch (rule.operator as RuleOperator) {
		case "equals":
			return String(fieldValue) === ruleValue;
		case "not_equals":
			return String(fieldValue) !== ruleValue;
		case "contains":
			return String(fieldValue ?? "")
				.toLowerCase()
				.includes(ruleValue.toLowerCase());
		case "not_contains":
			return !String(fieldValue ?? "")
				.toLowerCase()
				.includes(ruleValue.toLowerCase());
		case "greater_than":
			return Number(fieldValue) > Number(ruleValue);
		case "less_than":
			return Number(fieldValue) < Number(ruleValue);
		case "in": {
			const values = ruleValue.split(",").map((v) => v.trim());
			return values.includes(String(fieldValue));
		}
		case "not_in": {
			const values = ruleValue.split(",").map((v) => v.trim());
			return !values.includes(String(fieldValue));
		}
		default:
			return false;
	}
}

export function createCustomerGroupControllers(
	data: ModuleDataService,
): CustomerGroupController {
	return {
		async createGroup(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const group: CustomerGroup = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description ?? undefined,
				type: params.type ?? "manual",
				isActive: true,
				priority: params.priority ?? 0,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("customerGroup", id, group as Record<string, unknown>);

			return group;
		},

		async getGroup(id: string) {
			return (await data.get("customerGroup", id)) as CustomerGroup | null;
		},

		async getGroupBySlug(slug: string) {
			const groups = (await data.findMany("customerGroup", {
				where: { slug },
			})) as CustomerGroup[];

			return groups[0] ?? null;
		},

		async listGroups(opts = {}) {
			const { type, activeOnly = false } = opts;

			const where: Record<string, unknown> = {};
			if (type) where.type = type;
			if (activeOnly) where.isActive = true;

			const groups = (await data.findMany("customerGroup", {
				where,
			})) as CustomerGroup[];

			return groups.sort((a, b) => a.priority - b.priority);
		},

		async updateGroup(id, updateData) {
			const existing = (await data.get(
				"customerGroup",
				id,
			)) as CustomerGroup | null;
			if (!existing) {
				throw new Error(`Customer group ${id} not found`);
			}

			const updated: CustomerGroup = {
				...existing,
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.description !== undefined && {
					description: updateData.description,
				}),
				...(updateData.type !== undefined && { type: updateData.type }),
				...(updateData.isActive !== undefined && {
					isActive: updateData.isActive,
				}),
				...(updateData.priority !== undefined && {
					priority: updateData.priority,
				}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"customerGroup",
				id,
				updated as Record<string, unknown>,
			);

			return updated;
		},

		async deleteGroup(id: string) {
			// Delete associated memberships
			const memberships = (await data.findMany("groupMembership", {
				where: { groupId: id },
			})) as GroupMembership[];
			for (const m of memberships) {
				await data.delete("groupMembership", m.id);
			}

			// Delete associated rules
			const rules = (await data.findMany("groupRule", {
				where: { groupId: id },
			})) as GroupRule[];
			for (const r of rules) {
				await data.delete("groupRule", r.id);
			}

			// Delete associated price adjustments
			const adjustments = (await data.findMany("groupPriceAdjustment", {
				where: { groupId: id },
			})) as GroupPriceAdjustment[];
			for (const a of adjustments) {
				await data.delete("groupPriceAdjustment", a.id);
			}

			await data.delete("customerGroup", id);
		},

		async addMember(params) {
			// Check for existing membership
			const existing = (await data.findMany("groupMembership", {
				where: { groupId: params.groupId, customerId: params.customerId },
			})) as GroupMembership[];

			if (existing.length > 0) {
				throw new Error(
					`Customer ${params.customerId} is already a member of group ${params.groupId}`,
				);
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const membership: GroupMembership = {
				id,
				groupId: params.groupId,
				customerId: params.customerId,
				joinedAt: now,
				expiresAt: params.expiresAt ?? undefined,
				metadata: params.metadata ?? {},
			};

			await data.upsert(
				"groupMembership",
				id,
				membership as Record<string, unknown>,
			);

			return membership;
		},

		async removeMember(groupId: string, customerId: string) {
			const memberships = (await data.findMany("groupMembership", {
				where: { groupId, customerId },
			})) as GroupMembership[];

			for (const m of memberships) {
				await data.delete("groupMembership", m.id);
			}
		},

		async listMembers(groupId, opts = {}) {
			const { includeExpired = false } = opts;

			const memberships = (await data.findMany("groupMembership", {
				where: { groupId },
			})) as GroupMembership[];

			if (includeExpired) {
				return memberships;
			}

			const now = new Date();
			return memberships.filter(
				(m) => !m.expiresAt || m.expiresAt.getTime() > now.getTime(),
			);
		},

		async getCustomerGroups(customerId, opts = {}) {
			const { activeOnly = true } = opts;

			const memberships = (await data.findMany("groupMembership", {
				where: { customerId },
			})) as GroupMembership[];

			// Filter out expired memberships
			const now = new Date();
			const activeMemberships = memberships.filter(
				(m) => !m.expiresAt || m.expiresAt.getTime() > now.getTime(),
			);

			const groups: CustomerGroup[] = [];
			for (const m of activeMemberships) {
				const group = (await data.get(
					"customerGroup",
					m.groupId,
				)) as CustomerGroup | null;
				if (group) {
					if (activeOnly && !group.isActive) continue;
					groups.push(group);
				}
			}

			return groups.sort((a, b) => a.priority - b.priority);
		},

		async isMember(groupId: string, customerId: string) {
			const memberships = (await data.findMany("groupMembership", {
				where: { groupId, customerId },
			})) as GroupMembership[];

			if (memberships.length === 0) return false;

			const now = new Date();
			return memberships.some(
				(m) => !m.expiresAt || m.expiresAt.getTime() > now.getTime(),
			);
		},

		async bulkAddMembers(groupId, customerIds, opts = {}) {
			let added = 0;
			for (const customerId of customerIds) {
				// Skip if already a member
				const existing = (await data.findMany("groupMembership", {
					where: { groupId, customerId },
				})) as GroupMembership[];
				if (existing.length > 0) continue;

				const id = crypto.randomUUID();
				const membership: GroupMembership = {
					id,
					groupId,
					customerId,
					joinedAt: new Date(),
					expiresAt: opts.expiresAt ?? undefined,
					metadata: {},
				};
				await data.upsert(
					"groupMembership",
					id,
					membership as Record<string, unknown>,
				);
				added++;
			}
			return added;
		},

		async bulkRemoveMembers(groupId, customerIds) {
			let removed = 0;
			for (const customerId of customerIds) {
				const memberships = (await data.findMany("groupMembership", {
					where: { groupId, customerId },
				})) as GroupMembership[];
				for (const m of memberships) {
					await data.delete("groupMembership", m.id);
					removed++;
				}
			}
			return removed;
		},

		async addRule(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const rule: GroupRule = {
				id,
				groupId: params.groupId,
				field: params.field,
				operator: params.operator,
				value: params.value,
				createdAt: now,
			};

			await data.upsert("groupRule", id, rule as Record<string, unknown>);

			return rule;
		},

		async removeRule(ruleId: string) {
			await data.delete("groupRule", ruleId);
		},

		async listRules(groupId: string) {
			return (await data.findMany("groupRule", {
				where: { groupId },
			})) as GroupRule[];
		},

		async evaluateRules(customerData: Record<string, unknown>) {
			// Get all automatic groups
			const groups = (await data.findMany("customerGroup", {
				where: { type: "automatic", isActive: true },
			})) as CustomerGroup[];

			const matchingGroupIds: string[] = [];

			for (const group of groups) {
				const rules = (await data.findMany("groupRule", {
					where: { groupId: group.id },
				})) as GroupRule[];

				// All rules must match (AND logic)
				if (
					rules.length > 0 &&
					rules.every((r) => matchesRule(customerData, r))
				) {
					matchingGroupIds.push(group.id);
				}
			}

			return matchingGroupIds;
		},

		async setPriceAdjustment(params) {
			// Check for existing adjustment with same scope
			const existing = (await data.findMany("groupPriceAdjustment", {
				where: { groupId: params.groupId },
			})) as GroupPriceAdjustment[];

			const scope = params.scope ?? "all";
			const match = existing.find(
				(a) => a.scope === scope && a.scopeId === (params.scopeId ?? undefined),
			);

			const id = match?.id ?? crypto.randomUUID();
			const now = new Date();

			const adjustment: GroupPriceAdjustment = {
				id,
				groupId: params.groupId,
				adjustmentType: params.adjustmentType,
				value: params.value,
				scope,
				scopeId: params.scopeId ?? undefined,
				createdAt: match?.createdAt ?? now,
				updatedAt: now,
			};

			await data.upsert(
				"groupPriceAdjustment",
				id,
				adjustment as Record<string, unknown>,
			);

			return adjustment;
		},

		async removePriceAdjustment(id: string) {
			await data.delete("groupPriceAdjustment", id);
		},

		async listPriceAdjustments(groupId: string) {
			return (await data.findMany("groupPriceAdjustment", {
				where: { groupId },
			})) as GroupPriceAdjustment[];
		},

		async getCustomerPricing(customerId, opts = {}) {
			const { scope, scopeId } = opts;

			// Get customer's active group memberships
			const memberships = (await data.findMany("groupMembership", {
				where: { customerId },
			})) as GroupMembership[];

			const now = new Date();
			const activeMemberships = memberships.filter(
				(m) => !m.expiresAt || m.expiresAt.getTime() > now.getTime(),
			);

			const allAdjustments: GroupPriceAdjustment[] = [];

			for (const m of activeMemberships) {
				const group = (await data.get(
					"customerGroup",
					m.groupId,
				)) as CustomerGroup | null;
				if (!group?.isActive) continue;

				const adjustments = (await data.findMany("groupPriceAdjustment", {
					where: { groupId: m.groupId },
				})) as GroupPriceAdjustment[];

				for (const adj of adjustments) {
					// Filter by scope if specified
					if (scope && adj.scope !== "all" && adj.scope !== scope) continue;
					if (scopeId && adj.scopeId && adj.scopeId !== scopeId) continue;
					allAdjustments.push(adj);
				}
			}

			return allAdjustments;
		},

		async getStats() {
			const groups = (await data.findMany(
				"customerGroup",
				{},
			)) as CustomerGroup[];
			const memberships = (await data.findMany(
				"groupMembership",
				{},
			)) as GroupMembership[];
			const rules = (await data.findMany("groupRule", {})) as GroupRule[];
			const adjustments = (await data.findMany(
				"groupPriceAdjustment",
				{},
			)) as GroupPriceAdjustment[];

			return {
				totalGroups: groups.length,
				activeGroups: groups.filter((g) => g.isActive).length,
				manualGroups: groups.filter((g) => g.type === "manual").length,
				automaticGroups: groups.filter((g) => g.type === "automatic").length,
				totalMemberships: memberships.length,
				totalRules: rules.length,
				totalPriceAdjustments: adjustments.length,
			};
		},
	};
}
