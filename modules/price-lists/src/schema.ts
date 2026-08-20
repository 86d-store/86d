import type { ModuleSchema } from "@86d-app/core/types/schema";

export const priceListsSchema = {
	priceList: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			currency: { type: "string", required: false },
			priority: { type: "number", required: true },
			status: { type: "string", required: true },
			startsAt: { type: "date", required: false },
			endsAt: { type: "date", required: false },
			customerGroupId: { type: "string", required: false, index: true },
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
	priceEntry: {
		fields: {
			id: { type: "string", required: true },
			priceListId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			price: { type: "number", required: true },
			compareAtPrice: { type: "number", required: false },
			minQuantity: { type: "number", required: false },
			maxQuantity: { type: "number", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
