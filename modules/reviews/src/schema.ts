import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const reviewsSchema = {
	review: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			customerId: { type: "string", required: false },
			authorName: { type: "string", required: true },
			authorEmail: { type: "string", required: true },
			rating: { type: "number", required: true },
			title: { type: "string", required: false },
			body: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			isVerifiedPurchase: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			helpfulCount: { type: "number", required: true, defaultValue: 0 },
			images: { type: "json", required: false },
			merchantResponse: { type: "string", required: false },
			merchantResponseAt: { type: "date", required: false },
			moderationNote: { type: "string", required: false },
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
	reviewVote: {
		fields: {
			id: { type: "string", required: true },
			reviewId: { type: "string", required: true },
			voterId: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	reviewReport: {
		fields: {
			id: { type: "string", required: true },
			reviewId: { type: "string", required: true },
			reporterId: { type: "string", required: false },
			reason: { type: "string", required: true },
			details: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "pending" },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const reviewsTables = transcodeModuleSchema(reviewsSchema);
