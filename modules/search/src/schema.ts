import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const searchSchema = {
	searchIndex: {
		fields: {
			id: { type: "string", required: true },
			entityType: { type: "string", required: true },
			entityId: { type: "string", required: true },
			title: { type: "string", required: true },
			body: { type: "string", required: false },
			tags: { type: "json", required: false, defaultValue: [] },
			url: { type: "string", required: true },
			image: { type: "string", required: false },
			metadata: { type: "json", required: false, defaultValue: {} },
			indexedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	searchQuery: {
		fields: {
			id: { type: "string", required: true },
			term: { type: "string", required: true },
			normalizedTerm: { type: "string", required: true },
			resultCount: { type: "number", required: true },
			sessionId: { type: "string", required: false },
			searchedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	searchSynonym: {
		fields: {
			id: { type: "string", required: true },
			term: { type: "string", required: true },
			synonyms: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	searchClick: {
		fields: {
			id: { type: "string", required: true },
			queryId: { type: "string", required: true },
			term: { type: "string", required: true },
			entityType: { type: "string", required: true },
			entityId: { type: "string", required: true },
			position: { type: "number", required: true },
			clickedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const searchTables = transcodeModuleSchema(searchSchema);
