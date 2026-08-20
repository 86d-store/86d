import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const productFeedsFeedShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	channel: z.enum([
		"google-shopping",
		"facebook",
		"microsoft",
		"pinterest",
		"tiktok",
		"custom",
	]),
	format: z.enum(["xml", "csv", "tsv", "json"]).default("xml"),
	status: z.enum(["active", "paused", "error", "draft"]).default("draft"),
	country: z.string().optional(),
	currency: z.string().optional(),
	language: z.string().optional(),
	fieldMappings: z.array(z.unknown()).default([]),
	filters: z.record(z.string(), z.unknown()).default({}),
	itemCount: z.int().default(0),
	errorCount: z.int().default(0),
	warningCount: z.int().default(0),
	cachedOutput: z.string().optional(),
	lastGeneratedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productFeedsFeedItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	feedId: z.string().register(col, {
		references: { table: "self.feed", column: "id", onDelete: "cascade" },
	}),
	productId: z.string(),
	mappedData: z.record(z.string(), z.unknown()).default({}),
	status: z.enum(["valid", "warning", "error", "excluded"]).default("valid"),
	issues: z.array(z.unknown()).default([]),
	lastSyncedAt: z.coerce.date().default(() => new Date()),
});

export const productFeedsCategoryMappingShape = z.object({
	id: z.string().register(col, { pk: true }),
	feedId: z.string().register(col, {
		references: { table: "self.feed", column: "id", onDelete: "cascade" },
	}),
	storeCategory: z.string(),
	channelCategory: z.string(),
	channelCategoryId: z.string().optional(),
});

/** Native Relational storage for product-feeds. */
export const productFeedsStorage = {
	kind: "relational",
	tables: {
		feed: {
			shape: productFeedsFeedShape,
		},
		feedItem: {
			shape: productFeedsFeedItemShape,
		},
		categoryMapping: {
			shape: productFeedsCategoryMappingShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
