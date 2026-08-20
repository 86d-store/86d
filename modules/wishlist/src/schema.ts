import type { ModuleSchema } from "@86d-app/core/types/schema";

export const wishlistSchema = {
	wishlistItem: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: false },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			productImage: { type: "string", required: false },
			note: { type: "string", required: false },
			addedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	wishlistShare: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			token: { type: "string", required: true },
			active: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			expiresAt: { type: "date", required: false },
		},
	},
} satisfies ModuleSchema;
