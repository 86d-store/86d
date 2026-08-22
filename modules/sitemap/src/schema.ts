import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const sitemapSitemapConfigShape = z.object({
	id: z.string().register(col, { pk: true }),
	baseUrl: z.string(),
	includeProducts: z.boolean(),
	includeCollections: z.boolean(),
	includePages: z.boolean(),
	includeBlog: z.boolean(),
	includeBrands: z.boolean(),
	defaultChangeFreq: z.string(),
	defaultPriority: z.number(),
	productChangeFreq: z.string(),
	productPriority: z.number(),
	collectionChangeFreq: z.string(),
	collectionPriority: z.number(),
	pageChangeFreq: z.string(),
	pagePriority: z.number(),
	blogChangeFreq: z.string(),
	blogPriority: z.number(),
	excludedPaths: z.record(z.string(), z.unknown()).optional(),
	lastGenerated: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const sitemapSitemapEntryShape = z.object({
	id: z.string().register(col, { pk: true }),
	loc: z.string().register(col, { index: true }),
	lastmod: z.coerce.date().optional(),
	changefreq: z.string(),
	priority: z.number(),
	source: z.string().register(col, { index: true }),
	sourceId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for sitemap. */
export const sitemapStorage = {
	kind: "relational",
	tables: {
		sitemapConfig: {
			shape: sitemapSitemapConfigShape,
		},
		sitemapEntry: {
			shape: sitemapSitemapEntryShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
