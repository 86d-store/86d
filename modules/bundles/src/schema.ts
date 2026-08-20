import type { ModuleSchema } from "@86d-app/core/types/schema";

export const bundleSchema = {
	bundle: {
		fields: {
			id: { type: "string", required: true },
			/** Display name for the bundle */
			name: { type: "string", required: true },
			/** URL-safe slug */
			slug: { type: "string", required: true },
			/** Short marketing description */
			description: { type: "string", required: false },
			/** active | draft | archived */
			status: { type: "string", required: true },
			/** fixed | percentage — how the bundle price is calculated */
			discountType: { type: "string", required: true },
			/** Discount amount (fixed price or percentage off) */
			discountValue: { type: "number", required: true },
			/** Minimum quantity of items required to activate */
			minQuantity: { type: "number", required: false },
			/** Maximum quantity of items allowed */
			maxQuantity: { type: "number", required: false },
			/** Start date for availability */
			startsAt: { type: "string", required: false },
			/** End date for availability */
			endsAt: { type: "string", required: false },
			/** Featured image URL */
			imageUrl: { type: "string", required: false },
			/** Sort order for display */
			sortOrder: { type: "number", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	bundleItem: {
		fields: {
			id: { type: "string", required: true },
			bundleId: { type: "string", required: true },
			/** Product ID from the products module */
			productId: { type: "string", required: true },
			/** Optional variant ID */
			variantId: { type: "string", required: false },
			/** Quantity of this product in the bundle */
			quantity: { type: "number", required: true },
			/** Sort order within the bundle */
			sortOrder: { type: "number", required: false },
			/** Snapshot of product name at the time item was added */
			productName: { type: "string", required: false },
			/** Snapshot of product slug for building links */
			productSlug: { type: "string", required: false },
			/** Snapshot of product image URL */
			productImageUrl: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
