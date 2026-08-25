import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const searchSearchIndexShape = z.object({
	id: z.string().register(col, { pk: true }),
	entityType: z.string(),
	entityId: z.string(),
	title: z.string(),
	body: z.string().optional(),
	tags: z.array(z.unknown()).default([]),
	url: z.string(),
	image: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	indexedAt: z.coerce.date().default(() => new Date()),
});

export const searchSearchQueryShape = z.object({
	id: z.string().register(col, { pk: true }),
	term: z.string(),
	normalizedTerm: z.string(),
	resultCount: z.number(),
	sessionId: z.string().optional(),
	searchedAt: z.coerce.date().default(() => new Date()),
});

export const searchSearchSynonymShape = z.object({
	id: z.string().register(col, { pk: true }),
	term: z.string(),
	synonyms: z.array(z.string().min(1).max(200)).min(1).max(50),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const searchSearchClickShape = z.object({
	id: z.string().register(col, { pk: true }),
	queryId: z.string(),
	term: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	position: z.number(),
	clickedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for search. */
export const searchStorage = {
	kind: "relational",
	tables: {
		searchIndex: {
			shape: searchSearchIndexShape,
		},
		searchQuery: {
			shape: searchSearchQueryShape,
		},
		searchSynonym: {
			shape: searchSearchSynonymShape,
		},
		searchClick: {
			shape: searchSearchClickShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
