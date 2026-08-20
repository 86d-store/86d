import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const reviewsReviewShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	customerId: z.string().optional(),
	authorName: z.string(),
	authorEmail: z.string(),
	rating: z.number(),
	title: z.string().optional(),
	body: z.string(),
	status: z.string().default("pending"),
	isVerifiedPurchase: z.boolean().default(false),
	helpfulCount: z.int().default(0),
	images: z.record(z.string(), z.unknown()).optional(),
	merchantResponse: z.string().optional(),
	merchantResponseAt: z.coerce.date().optional(),
	moderationNote: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const reviewsReviewVoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	reviewId: z.string(),
	voterId: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const reviewsReviewReportShape = z.object({
	id: z.string().register(col, { pk: true }),
	reviewId: z.string(),
	reporterId: z.string().optional(),
	reason: z.string(),
	details: z.string().optional(),
	status: z.string().default("pending"),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for reviews. */
export const reviewsStorage = {
	kind: "relational",
	tables: {
		review: {
			shape: reviewsReviewShape,
		},
		reviewVote: {
			shape: reviewsReviewVoteShape,
		},
		reviewReport: {
			shape: reviewsReviewReportShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
