import type { ModuleSchema } from "@86d-app/core/types/schema";

export const bulkPricingSchema = {
	pricingRule: {
		fields: {
			id: { type: "string", required: true },
			/** Human-readable name (e.g. "Wholesale T-Shirt Pricing") */
			name: { type: "string", required: true },
			/** Optional description for admin reference */
			description: { type: "string", required: false },
			/** Which products this rule applies to */
			scope: {
				type: ["product", "variant", "collection", "global"] as const,
				required: true,
			},
			/** Target entity ID (product/variant/collection ID, null for global) */
			targetId: { type: "string", required: false, index: true },
			/** Priority when multiple rules match (higher = wins) */
			priority: { type: "number", required: true, defaultValue: 0 },
			/** Whether this rule is active */
			active: { type: "boolean", required: true, defaultValue: true },
			/** Optional start date for scheduled activation (ISO 8601) */
			startsAt: { type: "date", required: false },
			/** Optional end date for scheduled deactivation (ISO 8601) */
			endsAt: { type: "date", required: false },
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
	pricingTier: {
		fields: {
			id: { type: "string", required: true },
			/** Parent pricing rule */
			ruleId: {
				type: "string",
				required: true,
				references: {
					model: "pricingRule",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Minimum quantity to trigger this tier (inclusive) */
			minQuantity: { type: "number", required: true },
			/** Maximum quantity for this tier (inclusive, null = unlimited) */
			maxQuantity: { type: "number", required: false },
			/** Type of discount applied at this tier */
			discountType: {
				type: ["percentage", "fixed_amount", "fixed_price"] as const,
				required: true,
			},
			/** Discount value (percentage 0-100, or currency amount) */
			discountValue: { type: "number", required: true },
			/** Optional label shown to customers (e.g. "Buy 10+, save 15%") */
			label: { type: "string", required: false },
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
