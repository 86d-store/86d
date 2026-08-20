import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const sitemapSchema = {
	sitemapConfig: {
		fields: {
			id: { type: "string", required: true },
			baseUrl: { type: "string", required: true },
			includeProducts: { type: "boolean", required: true },
			includeCollections: { type: "boolean", required: true },
			includePages: { type: "boolean", required: true },
			includeBlog: { type: "boolean", required: true },
			includeBrands: { type: "boolean", required: true },
			defaultChangeFreq: { type: "string", required: true },
			defaultPriority: { type: "number", required: true },
			productChangeFreq: { type: "string", required: true },
			productPriority: { type: "number", required: true },
			collectionChangeFreq: { type: "string", required: true },
			collectionPriority: { type: "number", required: true },
			pageChangeFreq: { type: "string", required: true },
			pagePriority: { type: "number", required: true },
			blogChangeFreq: { type: "string", required: true },
			blogPriority: { type: "number", required: true },
			excludedPaths: { type: "json", required: false },
			lastGenerated: { type: "date", required: false },
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
	sitemapEntry: {
		fields: {
			id: { type: "string", required: true },
			loc: { type: "string", required: true, index: true },
			lastmod: { type: "date", required: false },
			changefreq: { type: "string", required: true },
			priority: { type: "number", required: true },
			source: { type: "string", required: true, index: true },
			sourceId: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const sitemapTables = transcodeModuleSchema(sitemapSchema);
