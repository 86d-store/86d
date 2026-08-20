import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const discountsDiscountShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
	value: z.number(),
	minimumAmount: z.number().optional(),
	maximumUses: z.number().optional(),
	usedCount: z.int().default(0),
	isActive: z.boolean().default(true),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	appliesTo: z
		.enum(["all", "specific_products", "specific_categories"])
		.default("all"),
	appliesToIds: z.array(z.unknown()).default([]),
	stackable: z.boolean().default(false),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const discountsDiscountCodeShape = z.object({
	id: z.string().register(col, { pk: true }),
	discountId: z.string().register(col, {
		references: { table: "self.discount", column: "id", onDelete: "cascade" },
	}),
	code: z.string().register(col, { unique: true }),
	usedCount: z.int().default(0),
	maximumUses: z.number().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const discountsCartPriceRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
	value: z.number(),
	conditions: z.array(z.unknown()).default([]),
	appliesTo: z
		.enum(["all", "specific_products", "specific_categories"])
		.default("all"),
	appliesToIds: z.array(z.unknown()).default([]),
	priority: z.int().default(0),
	stackable: z.boolean().default(false),
	maximumUses: z.number().optional(),
	usedCount: z.int().default(0),
	isActive: z.boolean().default(true),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for discounts. */
export const discountsStorage = {
	kind: "relational",
	tables: {
		discount: {
			shape: discountsDiscountShape,
		},
		discountCode: {
			shape: discountsDiscountCodeShape,
		},
		cartPriceRule: {
			shape: discountsCartPriceRuleShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
