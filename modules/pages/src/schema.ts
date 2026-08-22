import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const pagesPageShape = z.object({
	id: z.string().register(col, { pk: true }),
	title: z.string(),
	slug: z.string().register(col, { unique: true }),
	content: z.string(),
	excerpt: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]).default("draft"),
	template: z.string().optional(),
	metaTitle: z.string().optional(),
	metaDescription: z.string().optional(),
	featuredImage: z.string().optional(),
	position: z.int().default(0),
	showInNavigation: z.boolean().default(false),
	parentId: z
		.string()
		.register(col, {
			references: { table: "self.page", column: "id", onDelete: "set null" },
		})
		.optional(),
	publishedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for pages. */
export const pagesStorage = {
	kind: "relational",
	tables: {
		page: {
			shape: pagesPageShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
