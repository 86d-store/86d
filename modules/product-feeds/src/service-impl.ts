import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CategoryMapping,
	CreateFeedParams,
	Feed,
	FeedChannel,
	FeedFilters,
	FeedItem,
	FeedItemIssue,
	FeedItemStatus,
	FeedStats,
	FieldMapping,
	GenerateFeedResult,
	ProductData,
	ProductFeedsController,
	UpdateFeedParams,
} from "./service";

// ── Default field mappings per channel ───────────────────────────────

const GOOGLE_SHOPPING_MAPPINGS: FieldMapping[] = [
	{ sourceField: "id", targetField: "g:id" },
	{ sourceField: "title", targetField: "g:title" },
	{ sourceField: "description", targetField: "g:description" },
	{ sourceField: "url", targetField: "g:link" },
	{ sourceField: "imageUrl", targetField: "g:image_link" },
	{ sourceField: "price", targetField: "g:price" },
	{ sourceField: "availability", targetField: "g:availability" },
	{ sourceField: "brand", targetField: "g:brand" },
	{ sourceField: "barcode", targetField: "g:gtin" },
	{ sourceField: "sku", targetField: "g:mpn" },
	{ sourceField: "condition", targetField: "g:condition" },
	{ sourceField: "category", targetField: "g:google_product_category" },
	{ sourceField: "color", targetField: "g:color" },
	{ sourceField: "size", targetField: "g:size" },
	{ sourceField: "material", targetField: "g:material" },
	{ sourceField: "weight", targetField: "g:shipping_weight" },
];

const FACEBOOK_MAPPINGS: FieldMapping[] = [
	{ sourceField: "id", targetField: "id" },
	{ sourceField: "title", targetField: "title" },
	{ sourceField: "description", targetField: "description" },
	{ sourceField: "url", targetField: "link" },
	{ sourceField: "imageUrl", targetField: "image_link" },
	{ sourceField: "price", targetField: "price" },
	{ sourceField: "availability", targetField: "availability" },
	{ sourceField: "brand", targetField: "brand" },
	{ sourceField: "condition", targetField: "condition" },
	{ sourceField: "category", targetField: "google_product_category" },
	{ sourceField: "barcode", targetField: "gtin" },
	{ sourceField: "sku", targetField: "mpn" },
	{ sourceField: "color", targetField: "color" },
	{ sourceField: "size", targetField: "size" },
];

const MICROSOFT_MAPPINGS: FieldMapping[] = GOOGLE_SHOPPING_MAPPINGS;
const PINTEREST_MAPPINGS: FieldMapping[] = FACEBOOK_MAPPINGS;
const TIKTOK_MAPPINGS: FieldMapping[] = FACEBOOK_MAPPINGS;

function getDefaultMappings(channel: FeedChannel): FieldMapping[] {
	switch (channel) {
		case "google-shopping":
			return GOOGLE_SHOPPING_MAPPINGS;
		case "facebook":
			return FACEBOOK_MAPPINGS;
		case "microsoft":
			return MICROSOFT_MAPPINGS;
		case "pinterest":
			return PINTEREST_MAPPINGS;
		case "tiktok":
			return TIKTOK_MAPPINGS;
		case "custom":
			return [];
	}
}

// ── Field transform helpers ──────────────────────────────────────────

function applyTransform(
	value: string,
	transform: string | undefined,
	transformValue: string | undefined,
): string {
	if (!transform) return value;

	switch (transform) {
		case "uppercase":
			return value.toUpperCase();
		case "lowercase":
			return value.toLowerCase();
		case "prefix":
			return `${transformValue ?? ""}${value}`;
		case "suffix":
			return `${value}${transformValue ?? ""}`;
		case "template":
			return (transformValue ?? "").replace("{value}", value);
		default:
			return value;
	}
}

function resolveField(
	product: ProductData,
	mapping: FieldMapping,
): string | null {
	const { sourceField, transform, transformValue, defaultValue } = mapping;

	// Check custom fields first, then standard fields
	const rawValue: unknown =
		product.customFields?.[sourceField] ??
		(product as Record<string, unknown>)[sourceField];

	if (rawValue === undefined || rawValue === null || rawValue === "") {
		return defaultValue ?? null;
	}

	const strValue = String(rawValue);
	return applyTransform(strValue, transform, transformValue);
}

// ── Product filtering ────────────────────────────────────────────────

function passesFilters(product: ProductData, filters: FeedFilters): boolean {
	if (
		filters.includeStatuses &&
		filters.includeStatuses.length > 0 &&
		product.availability &&
		!filters.includeStatuses.includes(product.availability)
	)
		return false;

	if (
		filters.excludeCategories &&
		filters.excludeCategories.length > 0 &&
		product.category &&
		filters.excludeCategories.includes(product.category)
	)
		return false;

	if (
		filters.includeCategories &&
		filters.includeCategories.length > 0 &&
		product.category &&
		!filters.includeCategories.includes(product.category)
	)
		return false;

	if (filters.minPrice !== undefined && product.price < filters.minPrice) {
		return false;
	}

	if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
		return false;
	}

	if (filters.requireImages && !product.imageUrl) {
		return false;
	}

	if (filters.requireInStock && product.availability !== "in_stock") {
		return false;
	}

	return true;
}

// ── Validation ───────────────────────────────────────────────────────

function validateItem(
	mapped: Record<string, string>,
	channel: FeedChannel,
): FeedItemIssue[] {
	const issues: FeedItemIssue[] = [];

	// Channel-specific required fields
	const requiredFields = getRequiredFields(channel);
	for (const field of requiredFields) {
		if (!mapped[field]) {
			issues.push({
				field,
				severity: "error",
				message: `Required field "${field}" is missing`,
			});
		}
	}

	// Title length warnings
	const titleField = channel === "google-shopping" ? "g:title" : "title";
	const title = mapped[titleField];
	if (title && title.length > 150) {
		issues.push({
			field: titleField,
			severity: "warning",
			message: "Title exceeds 150 characters and may be truncated",
		});
	}

	// Description length warnings
	const descField =
		channel === "google-shopping" ? "g:description" : "description";
	const desc = mapped[descField];
	if (desc && desc.length > 5000) {
		issues.push({
			field: descField,
			severity: "warning",
			message: "Description exceeds 5000 characters",
		});
	}

	return issues;
}

function getRequiredFields(channel: FeedChannel): string[] {
	switch (channel) {
		case "google-shopping":
			return [
				"g:id",
				"g:title",
				"g:link",
				"g:price",
				"g:availability",
				"g:image_link",
			];
		case "facebook":
			return ["id", "title", "link", "price", "availability", "image_link"];
		case "microsoft":
			return [
				"g:id",
				"g:title",
				"g:link",
				"g:price",
				"g:availability",
				"g:image_link",
			];
		case "pinterest":
			return ["id", "title", "link", "price", "availability", "image_link"];
		case "tiktok":
			return ["id", "title", "link", "price", "availability", "image_link"];
		case "custom":
			return [];
	}
}

// ── Output formatters ────────────────────────────────────────────────

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function escapeCsv(str: string): string {
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function formatAsXml(items: Record<string, string>[]): string {
	const lines: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
		"<channel>",
	];

	for (const item of items) {
		lines.push("  <item>");
		for (const [key, value] of Object.entries(item)) {
			lines.push(`    <${key}>${escapeXml(value)}</${key}>`);
		}
		lines.push("  </item>");
	}

	lines.push("</channel>");
	lines.push("</rss>");
	return lines.join("\n");
}

function formatAsCsv(items: Record<string, string>[], separator = ","): string {
	if (items.length === 0) return "";

	const allKeys = new Set<string>();
	for (const item of items) {
		for (const key of Object.keys(item)) {
			allKeys.add(key);
		}
	}
	const headers = [...allKeys];

	const escapeField = separator === "\t" ? (s: string) => s : escapeCsv;

	const lines: string[] = [headers.join(separator)];
	for (const item of items) {
		const row = headers.map((h) => escapeField(item[h] ?? ""));
		lines.push(row.join(separator));
	}

	return lines.join("\n");
}

function formatAsJson(items: Record<string, string>[]): string {
	return JSON.stringify({ products: items }, null, 2);
}

function formatOutput(items: Record<string, string>[], format: string): string {
	switch (format) {
		case "xml":
			return formatAsXml(items);
		case "csv":
			return formatAsCsv(items, ",");
		case "tsv":
			return formatAsCsv(items, "\t");
		case "json":
			return formatAsJson(items);
		default:
			return formatAsXml(items);
	}
}

// ── Controller factory ───────────────────────────────────────────────

export function createProductFeedsController(
	data: ModuleDataService,
): ProductFeedsController {
	return {
		// ── Feed CRUD ──────────────────────────────────────────────────

		async createFeed(params: CreateFeedParams): Promise<Feed> {
			const id = crypto.randomUUID();
			const now = new Date();
			const mappings =
				params.fieldMappings ?? getDefaultMappings(params.channel);

			const feed: Feed = {
				id,
				name: params.name,
				slug: params.slug,
				channel: params.channel,
				format: params.format ?? "xml",
				status: "draft",
				country: params.country,
				currency: params.currency,
				language: params.language,
				fieldMappings: mappings,
				filters: params.filters ?? {},
				itemCount: 0,
				errorCount: 0,
				warningCount: 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("feed", id, feed as Record<string, unknown>);
			return feed;
		},

		async getFeed(id: string): Promise<Feed | null> {
			const raw = await data.get("feed", id);
			if (!raw) return null;
			return raw as unknown as Feed;
		},

		async getFeedBySlug(slug: string): Promise<Feed | null> {
			const results = await data.findMany("feed", {
				where: { slug },
				take: 1,
			});
			if (results.length === 0) return null;
			return results[0] as unknown as Feed;
		},

		async updateFeed(
			id: string,
			params: UpdateFeedParams,
		): Promise<Feed | null> {
			const existing = await data.get("feed", id);
			if (!existing) return null;

			const feed = existing as unknown as Feed;
			const updated: Feed = {
				...feed,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.slug !== undefined ? { slug: params.slug } : {}),
				...(params.channel !== undefined ? { channel: params.channel } : {}),
				...(params.format !== undefined ? { format: params.format } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.country !== undefined ? { country: params.country } : {}),
				...(params.currency !== undefined ? { currency: params.currency } : {}),
				...(params.language !== undefined ? { language: params.language } : {}),
				...(params.fieldMappings !== undefined
					? { fieldMappings: params.fieldMappings }
					: {}),
				...(params.filters !== undefined ? { filters: params.filters } : {}),
				updatedAt: new Date(),
			};

			await data.upsert("feed", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteFeed(id: string): Promise<boolean> {
			const existing = await data.get("feed", id);
			if (!existing) return false;

			// Delete associated feed items and category mappings
			const items = await data.findMany("feedItem", {
				where: { feedId: id },
			});
			for (const item of items) {
				await data.delete("feedItem", (item as unknown as FeedItem).id);
			}

			const mappings = await data.findMany("categoryMapping", {
				where: { feedId: id },
			});
			for (const mapping of mappings) {
				await data.delete(
					"categoryMapping",
					(mapping as unknown as CategoryMapping).id,
				);
			}

			await data.delete("feed", id);
			return true;
		},

		async listFeeds(params): Promise<Feed[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.channel) where.channel = params.channel;

			const results = await data.findMany("feed", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Feed[];
		},

		async countFeeds(): Promise<number> {
			const all = await data.findMany("feed", {});
			return all.length;
		},

		// ── Feed generation ────────────────────────────────────────────

		async generateFeed(
			id: string,
			products: ProductData[],
		): Promise<GenerateFeedResult | null> {
			const existing = await data.get("feed", id);
			if (!existing) return null;

			const feed = existing as unknown as Feed;

			// Clear previous feed items
			const prevItems = await data.findMany("feedItem", {
				where: { feedId: id },
			});
			for (const item of prevItems) {
				await data.delete("feedItem", (item as unknown as FeedItem).id);
			}

			// Load category mappings for this feed
			const mappingRecords = await data.findMany("categoryMapping", {
				where: { feedId: id },
			});
			const categoryMap = new Map<string, string>();
			for (const m of mappingRecords) {
				const mapping = m as unknown as CategoryMapping;
				categoryMap.set(mapping.storeCategory, mapping.channelCategory);
			}

			const mappedItems: Record<string, string>[] = [];
			let errorCount = 0;
			let warningCount = 0;
			const now = new Date();

			for (const product of products) {
				// Apply filters
				if (!passesFilters(product, feed.filters)) {
					const itemId = `${id}_${product.id}`;
					const feedItem: FeedItem = {
						id: itemId,
						feedId: id,
						productId: product.id,
						mappedData: {},
						status: "excluded",
						issues: [],
						lastSyncedAt: now,
					};
					await data.upsert(
						"feedItem",
						itemId,
						feedItem as Record<string, unknown>,
					);
					continue;
				}

				// Apply category mapping
				const productWithMapping = { ...product };
				if (product.category && categoryMap.has(product.category)) {
					productWithMapping.category = categoryMap.get(product.category);
				}

				// Map fields
				const mapped: Record<string, string> = {};
				for (const mapping of feed.fieldMappings) {
					const value = resolveField(productWithMapping, mapping);
					if (value !== null) {
						mapped[mapping.targetField] = value;
					}
				}

				// Validate
				const issues = validateItem(mapped, feed.channel);
				const hasErrors = issues.some((i) => i.severity === "error");
				const hasWarnings = issues.some((i) => i.severity === "warning");

				if (hasErrors) errorCount++;
				if (hasWarnings) warningCount++;

				const status: FeedItemStatus = hasErrors
					? "error"
					: hasWarnings
						? "warning"
						: "valid";

				const itemId = `${id}_${product.id}`;
				const feedItem: FeedItem = {
					id: itemId,
					feedId: id,
					productId: product.id,
					mappedData: mapped,
					status,
					issues,
					lastSyncedAt: now,
				};

				await data.upsert(
					"feedItem",
					itemId,
					feedItem as Record<string, unknown>,
				);

				// Only include valid/warning items in output
				if (!hasErrors) {
					mappedItems.push(mapped);
				}
			}

			// Generate output
			const output = formatOutput(mappedItems, feed.format);

			// Update feed with generation results
			const updatedFeed: Feed = {
				...feed,
				itemCount: mappedItems.length,
				errorCount,
				warningCount,
				cachedOutput: output,
				lastGeneratedAt: now,
				status:
					errorCount > 0
						? "error"
						: feed.status === "draft"
							? "active"
							: feed.status,
				updatedAt: now,
			};

			await data.upsert("feed", id, updatedFeed as Record<string, unknown>);

			return {
				itemCount: mappedItems.length,
				errorCount,
				warningCount,
				output,
			};
		},

		async getFeedOutput(id: string): Promise<string | null> {
			const raw = await data.get("feed", id);
			if (!raw) return null;
			const feed = raw as unknown as Feed;
			return feed.cachedOutput ?? null;
		},

		// ── Feed items ─────────────────────────────────────────────────

		async getFeedItems(feedId, params): Promise<FeedItem[]> {
			const where: Record<string, unknown> = { feedId };
			if (params?.status) where.status = params.status;

			const results = await data.findMany("feedItem", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as FeedItem[];
		},

		async getFeedItem(
			feedId: string,
			productId: string,
		): Promise<FeedItem | null> {
			const itemId = `${feedId}_${productId}`;
			const raw = await data.get("feedItem", itemId);
			if (!raw) return null;
			return raw as unknown as FeedItem;
		},

		async countFeedItems(feedId: string): Promise<number> {
			const items = await data.findMany("feedItem", {
				where: { feedId },
			});
			return items.length;
		},

		// ── Category mappings ──────────────────────────────────────────

		async addCategoryMapping(feedId, params): Promise<CategoryMapping> {
			const id = crypto.randomUUID();
			const mapping: CategoryMapping = {
				id,
				feedId,
				storeCategory: params.storeCategory,
				channelCategory: params.channelCategory,
				channelCategoryId: params.channelCategoryId,
			};

			await data.upsert(
				"categoryMapping",
				id,
				mapping as Record<string, unknown>,
			);
			return mapping;
		},

		async updateCategoryMapping(id, params): Promise<CategoryMapping | null> {
			const raw = await data.get("categoryMapping", id);
			if (!raw) return null;

			const existing = raw as unknown as CategoryMapping;
			const updated: CategoryMapping = {
				...existing,
				...(params.channelCategory !== undefined
					? { channelCategory: params.channelCategory }
					: {}),
				...(params.channelCategoryId !== undefined
					? { channelCategoryId: params.channelCategoryId }
					: {}),
			};

			await data.upsert(
				"categoryMapping",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deleteCategoryMapping(id: string): Promise<boolean> {
			const raw = await data.get("categoryMapping", id);
			if (!raw) return false;
			await data.delete("categoryMapping", id);
			return true;
		},

		async listCategoryMappings(feedId: string): Promise<CategoryMapping[]> {
			const results = await data.findMany("categoryMapping", {
				where: { feedId },
			});
			return results as unknown as CategoryMapping[];
		},

		// ── Validation ─────────────────────────────────────────────────

		async validateFeed(id: string): Promise<FeedItemIssue[]> {
			const raw = await data.get("feed", id);
			if (!raw) return [];

			const feed = raw as unknown as Feed;
			const allIssues: FeedItemIssue[] = [];

			// Check feed-level issues
			if (feed.fieldMappings.length === 0) {
				allIssues.push({
					field: "fieldMappings",
					severity: "error",
					message: "No field mappings configured",
				});
			}

			// Check if required target fields are mapped
			const requiredFields = getRequiredFields(feed.channel);
			const mappedTargets = new Set(
				feed.fieldMappings.map((m) => m.targetField),
			);
			for (const field of requiredFields) {
				if (!mappedTargets.has(field)) {
					allIssues.push({
						field,
						severity: "warning",
						message: `Required channel field "${field}" has no mapping`,
					});
				}
			}

			// Collect item-level issues
			const items = await data.findMany("feedItem", {
				where: { feedId: id },
			});
			for (const item of items) {
				const feedItem = item as unknown as FeedItem;
				for (const issue of feedItem.issues) {
					allIssues.push(issue);
				}
			}

			return allIssues;
		},

		// ── Stats ──────────────────────────────────────────────────────

		async getStats(): Promise<FeedStats> {
			const feeds = await data.findMany("feed", {});
			const feedList = feeds as unknown as Feed[];

			const activeFeeds = feedList.filter((f) => f.status === "active").length;

			const items = await data.findMany("feedItem", {});
			const itemList = items as unknown as FeedItem[];

			const errorItems = itemList.filter((i) => i.status === "error").length;
			const warningItems = itemList.filter(
				(i) => i.status === "warning",
			).length;

			return {
				totalFeeds: feedList.length,
				activeFeeds,
				totalItems: itemList.length,
				errorItems,
				warningItems,
			};
		},
	};
}
