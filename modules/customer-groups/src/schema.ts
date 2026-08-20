import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const customerGroupsCustomerGroupShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	type: z.string().default("manual"),
	isActive: z.boolean().default(true),
	priority: z.int().default(0),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const customerGroupsGroupMembershipShape = z.object({
	id: z.string().register(col, { pk: true }),
	groupId: z.string().register(col, {
		references: {
			table: "self.customerGroup",
			column: "id",
			onDelete: "cascade",
		},
	}),
	customerId: z.string(),
	joinedAt: z.coerce.date().default(() => new Date()),
	expiresAt: z.coerce.date().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
});

export const customerGroupsGroupRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	groupId: z.string().register(col, {
		references: {
			table: "self.customerGroup",
			column: "id",
			onDelete: "cascade",
		},
	}),
	field: z.string(),
	operator: z.string(),
	value: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const customerGroupsGroupPriceAdjustmentShape = z.object({
	id: z.string().register(col, { pk: true }),
	groupId: z.string().register(col, {
		references: {
			table: "self.customerGroup",
			column: "id",
			onDelete: "cascade",
		},
	}),
	adjustmentType: z.string(),
	value: z.number(),
	scope: z.string().default("all"),
	scopeId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for customer-groups. */
export const customerGroupsStorage = {
	kind: "relational",
	tables: {
		customerGroup: {
			shape: customerGroupsCustomerGroupShape,
		},
		groupMembership: {
			shape: customerGroupsGroupMembershipShape,
		},
		groupRule: {
			shape: customerGroupsGroupRuleShape,
		},
		groupPriceAdjustment: {
			shape: customerGroupsGroupPriceAdjustmentShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
