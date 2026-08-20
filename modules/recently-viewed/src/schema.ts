import type { ModuleSchema } from "@86d-app/core/types/schema";

export const recentlyViewedSchema = {
	productView: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: false },
			sessionId: { type: "string", required: false },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			productSlug: { type: "string", required: true },
			productImage: { type: "string", required: false },
			productPrice: { type: "number", required: false },
			viewedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
