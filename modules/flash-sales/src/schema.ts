import type { ModuleSchema } from "@86d-app/core/types/schema";

export const flashSalesSchema = {
	flashSale: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			status: { type: "string", required: true },
			startsAt: { type: "date", required: true },
			endsAt: { type: "date", required: true },
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
	flashSaleProduct: {
		fields: {
			id: { type: "string", required: true },
			flashSaleId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			salePrice: { type: "number", required: true },
			originalPrice: { type: "number", required: true },
			stockLimit: { type: "number", required: false },
			stockSold: { type: "number", required: true },
			sortOrder: { type: "number", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
