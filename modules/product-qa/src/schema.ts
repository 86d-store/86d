import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const productQaQuestionShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	customerId: z.string().optional(),
	authorName: z.string(),
	authorEmail: z.string(),
	body: z.string(),
	status: z.string().default("pending"),
	upvoteCount: z.int().default(0),
	answerCount: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productQaAnswerShape = z.object({
	id: z.string().register(col, { pk: true }),
	questionId: z.string(),
	productId: z.string(),
	customerId: z.string().optional(),
	authorName: z.string(),
	authorEmail: z.string(),
	body: z.string(),
	isOfficial: z.boolean().default(false),
	upvoteCount: z.int().default(0),
	status: z.string().default("pending"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for product-qa. */
export const productQaStorage = {
	kind: "relational",
	tables: {
		question: {
			shape: productQaQuestionShape,
		},
		answer: {
			shape: productQaAnswerShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
