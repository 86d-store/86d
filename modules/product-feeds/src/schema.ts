import type { ModuleSchema } from "@86d-app/core/types/schema";

export const productFeedsSchema = {
	feed: {
		fields: {
			id: { type: "string", required: true },
			/** Human-readable name (e.g. "Google Shopping - US") */
			name: { type: "string", required: true },
			/** URL-safe slug used in public feed URLs */
			slug: { type: "string", required: true, unique: true },
			/** Channel type determines default field mappings and output format */
			channel: {
				type: [
					"google-shopping",
					"facebook",
					"microsoft",
					"pinterest",
					"tiktok",
					"custom",
				],
				required: true,
			},
			/** Output format for the feed file */
			format: {
				type: ["xml", "csv", "tsv", "json"],
				required: true,
				defaultValue: "xml",
			},
			status: {
				type: ["active", "paused", "error", "draft"],
				required: true,
				defaultValue: "draft",
			},
			/** ISO country code for localized feeds (e.g. "US", "GB") */
			country: { type: "string", required: false },
			/** ISO currency code (e.g. "USD", "GBP") */
			currency: { type: "string", required: false },
			/** ISO language code (e.g. "en", "fr") */
			language: { type: "string", required: false },
			/**
			 * JSON array of field mapping objects:
			 * [{ sourceField, targetField, transform?, defaultValue? }]
			 */
			fieldMappings: { type: "json", required: false, defaultValue: [] },
			/**
			 * JSON object with filter rules for product inclusion/exclusion:
			 * { includeStatuses?, excludeCategories?, minPrice?, maxPrice?, requireImages? }
			 */
			filters: { type: "json", required: false, defaultValue: {} },
			/** Total products included in last generation */
			itemCount: { type: "number", required: true, defaultValue: 0 },
			/** Number of items with errors in last generation */
			errorCount: { type: "number", required: true, defaultValue: 0 },
			/** Number of items with warnings */
			warningCount: { type: "number", required: true, defaultValue: 0 },
			/** Cached feed output data */
			cachedOutput: { type: "string", required: false },
			lastGeneratedAt: { type: "date", required: false },
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
	feedItem: {
		fields: {
			id: { type: "string", required: true },
			feedId: {
				type: "string",
				required: true,
				references: { model: "feed", field: "id", onDelete: "cascade" },
			},
			productId: { type: "string", required: true },
			/** Snapshot of mapped product data ready for feed output */
			mappedData: { type: "json", required: true, defaultValue: {} },
			status: {
				type: ["valid", "warning", "error", "excluded"],
				required: true,
				defaultValue: "valid",
			},
			/** JSON array of validation issues [{field, severity, message}] */
			issues: { type: "json", required: false, defaultValue: [] },
			lastSyncedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	categoryMapping: {
		fields: {
			id: { type: "string", required: true },
			feedId: {
				type: "string",
				required: true,
				references: { model: "feed", field: "id", onDelete: "cascade" },
			},
			/** Store's internal category identifier */
			storeCategory: { type: "string", required: true },
			/** Channel-specific category string (e.g. Google product taxonomy) */
			channelCategory: { type: "string", required: true },
			/** Channel-specific category ID if applicable */
			channelCategoryId: { type: "string", required: false },
		},
	},
} satisfies ModuleSchema;
