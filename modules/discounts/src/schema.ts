import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const discountsSchema = {
	discount: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			type: {
				type: ["percentage", "fixed_amount", "free_shipping"],
				required: true,
			},
			/** Percentage: 0-100. Fixed: amount in cents. Free shipping: ignored. */
			value: { type: "number", required: true },
			/** Minimum cart subtotal (in cents) required to apply */
			minimumAmount: { type: "number", required: false },
			/** Total redemption cap across all codes */
			maximumUses: { type: "number", required: false },
			usedCount: { type: "number", required: true, defaultValue: 0 },
			isActive: { type: "boolean", required: true, defaultValue: true },
			startsAt: { type: "date", required: false },
			endsAt: { type: "date", required: false },
			/** "all" | "specific_products" | "specific_categories" */
			appliesTo: {
				type: ["all", "specific_products", "specific_categories"],
				required: true,
				defaultValue: "all",
			},
			/** JSON array of product/category IDs */
			appliesToIds: { type: "json", required: false, defaultValue: [] },
			/** Whether this discount stacks with others */
			stackable: { type: "boolean", required: true, defaultValue: false },
			metadata: { type: "json", required: false, defaultValue: {} },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	discountCode: {
		fields: {
			id: { type: "string", required: true },
			discountId: {
				type: "string",
				required: true,
				references: { model: "discount", field: "id", onDelete: "cascade" },
			},
			code: { type: "string", required: true, unique: true },
			usedCount: { type: "number", required: true, defaultValue: 0 },
			/** Per-code usage limit (null = unlimited) */
			maximumUses: { type: "number", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	cartPriceRule: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			type: {
				type: ["percentage", "fixed_amount", "free_shipping"],
				required: true,
			},
			value: { type: "number", required: true },
			/** JSON array of CartPriceRuleCondition objects */
			conditions: { type: "json", required: true, defaultValue: [] },
			appliesTo: {
				type: ["all", "specific_products", "specific_categories"],
				required: true,
				defaultValue: "all",
			},
			appliesToIds: { type: "json", required: false, defaultValue: [] },
			/** Lower = higher priority */
			priority: { type: "number", required: true, defaultValue: 0 },
			stackable: { type: "boolean", required: true, defaultValue: false },
			maximumUses: { type: "number", required: false },
			usedCount: { type: "number", required: true, defaultValue: 0 },
			isActive: { type: "boolean", required: true, defaultValue: true },
			startsAt: { type: "date", required: false },
			endsAt: { type: "date", required: false },
			metadata: { type: "json", required: false, defaultValue: {} },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const discountsTables = transcodeModuleSchema(discountsSchema);
