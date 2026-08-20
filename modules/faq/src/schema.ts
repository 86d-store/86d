import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const faqFaqCategoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	icon: z.string().optional(),
	position: z.int().default(0),
	isVisible: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const faqFaqItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	categoryId: z.string().register(col, {
		references: {
			table: "self.faqCategory",
			column: "id",
			onDelete: "cascade",
		},
	}),
	question: z.string(),
	answer: z.string(),
	slug: z.string().register(col, { unique: true }),
	position: z.int().default(0),
	isVisible: z.boolean().default(true),
	tags: z.array(z.unknown()).default([]),
	helpfulCount: z.int().default(0),
	notHelpfulCount: z.int().default(0),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for faq. */
export const faqStorage = {
	kind: "relational",
	tables: {
		faqCategory: {
			shape: faqFaqCategoryShape,
		},
		faqItem: {
			shape: faqFaqItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
