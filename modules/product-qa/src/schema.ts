import type { ModuleSchema } from "@86d-app/core/types/schema";

export const productQaSchema = {
	question: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			customerId: { type: "string", required: false },
			authorName: { type: "string", required: true },
			authorEmail: { type: "string", required: true },
			body: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			upvoteCount: { type: "number", required: true, defaultValue: 0 },
			answerCount: { type: "number", required: true, defaultValue: 0 },
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
	answer: {
		fields: {
			id: { type: "string", required: true },
			questionId: { type: "string", required: true },
			productId: { type: "string", required: true },
			customerId: { type: "string", required: false },
			authorName: { type: "string", required: true },
			authorEmail: { type: "string", required: true },
			body: { type: "string", required: true },
			isOfficial: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			upvoteCount: { type: "number", required: true, defaultValue: 0 },
			status: { type: "string", required: true, defaultValue: "pending" },
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
