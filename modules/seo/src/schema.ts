import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const seoSchema = {
	metaTag: {
		fields: {
			id: { type: "string", required: true },
			path: { type: "string", required: true },
			title: { type: "string", required: false },
			description: { type: "string", required: false },
			canonicalUrl: { type: "string", required: false },
			ogTitle: { type: "string", required: false },
			ogDescription: { type: "string", required: false },
			ogImage: { type: "string", required: false },
			ogType: { type: "string", required: false },
			twitterCard: { type: "string", required: false },
			twitterTitle: { type: "string", required: false },
			twitterDescription: { type: "string", required: false },
			twitterImage: { type: "string", required: false },
			noIndex: { type: "string", required: true, defaultValue: "false" },
			noFollow: { type: "string", required: true, defaultValue: "false" },
			jsonLd: { type: "json", required: false },
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
	redirect: {
		fields: {
			id: { type: "string", required: true },
			fromPath: { type: "string", required: true },
			toPath: { type: "string", required: true },
			statusCode: { type: "string", required: true, defaultValue: "301" },
			active: { type: "string", required: true, defaultValue: "true" },
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

export const seoTables = transcodeModuleSchema(seoSchema);
