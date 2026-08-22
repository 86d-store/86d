import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const recommendationsRecommendationRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	strategy: z.string(),
	sourceProductId: z.string().optional(),
	targetProductIds: z.record(z.string(), z.unknown()),
	weight: z.number(),
	isActive: z.boolean(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const recommendationsCoOccurrenceShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId1: z.string(),
	productId2: z.string(),
	count: z.number(),
	lastOccurredAt: z.coerce.date().default(() => new Date()),
});

export const recommendationsProductInteractionShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	customerId: z.string().optional(),
	sessionId: z.string().optional(),
	type: z.string(),
	productName: z.string(),
	productSlug: z.string(),
	productImage: z.string().optional(),
	productPrice: z.number().optional(),
	productCategory: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const recommendationsProductEmbeddingShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	embedding: z.record(z.string(), z.unknown()),
	text: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const recommendationsRecommendationImpressionShape = z.object({
	id: z.string().register(col, { pk: true }),
	surface: z.string(),
	sourceProductId: z.string().optional(),
	customerId: z.string().optional(),
	sessionId: z.string().optional(),
	productIds: z.record(z.string(), z.unknown()),
	strategies: z.record(z.string(), z.unknown()),
	servedAt: z.coerce.date().default(() => new Date()),
});

export const recommendationsRecommendationClickShape = z.object({
	id: z.string().register(col, { pk: true }),
	impressionId: z.string(),
	surface: z.string(),
	productId: z.string(),
	position: z.number(),
	strategy: z.string().optional(),
	clickedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for recommendations. */
export const recommendationsStorage = {
	kind: "relational",
	tables: {
		recommendationRule: {
			shape: recommendationsRecommendationRuleShape,
		},
		coOccurrence: {
			shape: recommendationsCoOccurrenceShape,
		},
		productInteraction: {
			shape: recommendationsProductInteractionShape,
		},
		productEmbedding: {
			shape: recommendationsProductEmbeddingShape,
		},
		recommendationImpression: {
			shape: recommendationsRecommendationImpressionShape,
		},
		recommendationClick: {
			shape: recommendationsRecommendationClickShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
