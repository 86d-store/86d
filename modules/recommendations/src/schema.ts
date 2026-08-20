import type { ModuleSchema } from "@86d-app/core/types/schema";

export const recommendationsSchema = {
	recommendationRule: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			strategy: { type: "string", required: true },
			sourceProductId: { type: "string", required: false },
			targetProductIds: { type: "json", required: true },
			weight: { type: "number", required: true },
			isActive: { type: "boolean", required: true },
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
	coOccurrence: {
		fields: {
			id: { type: "string", required: true },
			productId1: { type: "string", required: true },
			productId2: { type: "string", required: true },
			count: { type: "number", required: true },
			lastOccurredAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	productInteraction: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			customerId: { type: "string", required: false },
			sessionId: { type: "string", required: false },
			type: { type: "string", required: true },
			productName: { type: "string", required: true },
			productSlug: { type: "string", required: true },
			productImage: { type: "string", required: false },
			productPrice: { type: "number", required: false },
			productCategory: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	productEmbedding: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			embedding: { type: "json", required: true },
			text: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	recommendationImpression: {
		fields: {
			id: { type: "string", required: true },
			surface: { type: "string", required: true },
			sourceProductId: { type: "string", required: false },
			customerId: { type: "string", required: false },
			sessionId: { type: "string", required: false },
			productIds: { type: "json", required: true },
			strategies: { type: "json", required: true },
			servedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	recommendationClick: {
		fields: {
			id: { type: "string", required: true },
			impressionId: { type: "string", required: true },
			surface: { type: "string", required: true },
			productId: { type: "string", required: true },
			position: { type: "number", required: true },
			strategy: { type: "string", required: false },
			clickedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
