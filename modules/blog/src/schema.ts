import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const blogPostShape = z.object({
	id: z.string().register(col, { pk: true }),
	title: z.string(),
	slug: z.string(),
	content: z.string(),
	excerpt: z.string().optional(),
	coverImage: z.string().optional(),
	author: z.string().optional(),
	status: z.string().default("draft"),
	tags: z.array(z.unknown()).default([]),
	category: z.string().optional(),
	featured: z.boolean().default(false),
	readingTime: z.int().default(0),
	metaTitle: z.string().optional(),
	metaDescription: z.string().optional(),
	scheduledAt: z.coerce.date().optional(),
	publishedAt: z.coerce.date().optional(),
	views: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for blog. */
export const blogStorage = {
	kind: "relational",
	tables: {
		post: {
			shape: blogPostShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
