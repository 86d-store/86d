import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const bulkPricingPricingRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	scope: z.enum(["product", "variant", "collection", "global"]),
	targetId: z.string().register(col, { index: true }).optional(),
	priority: z.int().default(0),
	active: z.boolean().default(true),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const bulkPricingPricingTierShape = z.object({
	id: z.string().register(col, { pk: true }),
	ruleId: z.string().register(col, {
		references: {
			table: "self.pricingRule",
			column: "id",
			onDelete: "cascade",
		},
	}),
	minQuantity: z.number(),
	maxQuantity: z.number().optional(),
	discountType: z.enum(["percentage", "fixed_amount", "fixed_price"]),
	discountValue: z.number(),
	label: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for bulk-pricing. */
export const bulkPricingStorage = {
	kind: "relational",
	tables: {
		pricingRule: {
			shape: bulkPricingPricingRuleShape,
		},
		pricingTier: {
			shape: bulkPricingPricingTierShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
