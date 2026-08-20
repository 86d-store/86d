import { describe, expect, it, vi } from "vitest";
import { addCategoryMapping } from "../admin/endpoints/add-category-mapping";
import { createFeed } from "../admin/endpoints/create-feed";
import { deleteCategoryMapping } from "../admin/endpoints/delete-category-mapping";
import { deleteFeed } from "../admin/endpoints/delete-feed";
import { generateFeed } from "../admin/endpoints/generate-feed";
import { getFeed } from "../admin/endpoints/get-feed";
import { getFeedItems } from "../admin/endpoints/get-feed-items";
import { getStats } from "../admin/endpoints/get-stats";
import { listCategoryMappings } from "../admin/endpoints/list-category-mappings";
import { listFeeds } from "../admin/endpoints/list-feeds";
import { updateFeed } from "../admin/endpoints/update-feed";
import { validateFeed } from "../admin/endpoints/validate-feed";
import type {
	CategoryMapping,
	Feed,
	FeedItem,
	FeedItemIssue,
	FeedStats,
	ProductFeedsController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeFeed(overrides: Partial<Feed> = {}): Feed {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Google Feed",
		slug: "google-feed",
		channel: "google-shopping",
		format: "xml",
		status: "draft",
		fieldMappings: [],
		filters: {},
		itemCount: 0,
		errorCount: 0,
		warningCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
	return {
		id: crypto.randomUUID(),
		feedId: "feed_1",
		productId: "prod_1",
		mappedData: {},
		status: "valid",
		issues: [],
		lastSyncedAt: new Date(),
		...overrides,
	};
}

function makeMapping(
	overrides: Partial<CategoryMapping> = {},
): CategoryMapping {
	return {
		id: crypto.randomUUID(),
		feedId: "feed_1",
		storeCategory: "Electronics",
		channelCategory: "Electronics & Computers",
		...overrides,
	};
}

function makeController(
	overrides: Partial<ProductFeedsController> = {},
): ProductFeedsController {
	return {
		createFeed: vi.fn().mockResolvedValue(makeFeed()),
		getFeed: vi.fn().mockResolvedValue(null),
		getFeedBySlug: vi.fn().mockResolvedValue(null),
		updateFeed: vi.fn().mockResolvedValue(null),
		deleteFeed: vi.fn().mockResolvedValue(false),
		listFeeds: vi.fn().mockResolvedValue([]),
		countFeeds: vi.fn().mockResolvedValue(0),
		generateFeed: vi.fn().mockResolvedValue(null),
		getFeedOutput: vi.fn().mockResolvedValue(null),
		getFeedItems: vi.fn().mockResolvedValue([]),
		getFeedItem: vi.fn().mockResolvedValue(null),
		countFeedItems: vi.fn().mockResolvedValue(0),
		addCategoryMapping: vi.fn().mockResolvedValue(makeMapping()),
		updateCategoryMapping: vi.fn().mockResolvedValue(null),
		deleteCategoryMapping: vi.fn().mockResolvedValue(false),
		listCategoryMappings: vi.fn().mockResolvedValue([]),
		validateFeed: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			totalFeeds: 0,
			activeFeeds: 0,
			totalItems: 0,
			errorItems: 0,
			warningItems: 0,
		} satisfies FeedStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ProductFeedsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { productFeeds: opts.controller ?? makeController() },
		},
	});
}

const listFeedsHandler = extractHandler(listFeeds);
const getStatsHandler = extractHandler(getStats);
const createFeedHandler = extractHandler(createFeed);
const getFeedHandler = extractHandler(getFeed);
const updateFeedHandler = extractHandler(updateFeed);
const deleteFeedHandler = extractHandler(deleteFeed);
const generateFeedHandler = extractHandler(generateFeed);
const getFeedItemsHandler = extractHandler(getFeedItems);
const validateFeedHandler = extractHandler(validateFeed);
const listMappingsHandler = extractHandler(listCategoryMappings);
const addMappingHandler = extractHandler(addCategoryMapping);
const deleteMappingHandler = extractHandler(deleteCategoryMapping);

describe("admin GET /product-feeds", () => {
	it("returns empty list", async () => {
		const result = (await call(listFeedsHandler)) as {
			feeds: Feed[];
			total: number;
		};
		expect(result.feeds).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listFeedsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listFeeds).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});

	it("returns list of feeds", async () => {
		const feeds = [
			makeFeed({ status: "active" }),
			makeFeed({ status: "paused" }),
		];
		const ctrl = makeController({
			listFeeds: vi.fn().mockResolvedValue(feeds),
		});
		const result = (await call(listFeedsHandler, { controller: ctrl })) as {
			feeds: Feed[];
			total: number;
		};
		expect(result.feeds).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

describe("admin GET /product-feeds/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as { stats: FeedStats };
		expect(result.stats.totalFeeds).toBe(0);
		expect(result.stats.activeFeeds).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalFeeds: 5,
				activeFeeds: 3,
				totalItems: 1200,
				errorItems: 10,
				warningItems: 25,
			}),
		});
		const result = (await call(getStatsHandler, { controller: ctrl })) as {
			stats: FeedStats;
		};
		expect(result.stats.totalFeeds).toBe(5);
		expect(result.stats.activeFeeds).toBe(3);
		expect(result.stats.totalItems).toBe(1200);
	});
});

describe("admin POST /product-feeds/create", () => {
	it("creates a feed and returns it", async () => {
		const feed = makeFeed({ name: "Facebook Feed", channel: "facebook" });
		const ctrl = makeController({
			createFeed: vi.fn().mockResolvedValue(feed),
		});
		const result = (await call(createFeedHandler, {
			body: {
				name: "Facebook Feed",
				slug: "facebook-feed",
				channel: "facebook",
				format: "json",
			},
			controller: ctrl,
		})) as { feed: Feed };
		expect(result.feed.name).toBe("Facebook Feed");
		expect(result.feed.channel).toBe("facebook");
	});
});

describe("admin GET /product-feeds/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getFeedHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("returns feed when found", async () => {
		const feed = makeFeed({ id: "feed_1" });
		const ctrl = makeController({
			getFeed: vi.fn().mockResolvedValue(feed),
		});
		const result = (await call(getFeedHandler, {
			params: { id: "feed_1" },
			controller: ctrl,
		})) as { feed: Feed };
		expect(result.feed.id).toBe("feed_1");
	});
});

describe("admin POST /product-feeds/:id/update", () => {
	it("returns error when not found", async () => {
		const result = (await call(updateFeedHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates feed and returns it", async () => {
		const feed = makeFeed({ status: "active" });
		const ctrl = makeController({
			updateFeed: vi.fn().mockResolvedValue(feed),
		});
		const result = (await call(updateFeedHandler, {
			params: { id: feed.id },
			body: { status: "active" },
			controller: ctrl,
		})) as { feed: Feed };
		expect(result.feed.status).toBe("active");
	});
});

describe("admin POST /product-feeds/:id/delete", () => {
	it("returns error when not found", async () => {
		const result = (await call(deleteFeedHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("deletes feed and returns success", async () => {
		const ctrl = makeController({
			deleteFeed: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteFeedHandler, {
			params: { id: "feed_1" },
			body: {},
			controller: ctrl,
		})) as { success: true };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /product-feeds/:id/generate", () => {
	it("rejects caller-supplied Product snapshots before generation", async () => {
		const controller = makeController();

		await expect(
			call(generateFeedHandler, {
				params: { id: "feed_1" },
				body: { products: [{ id: "browser-product", price: 0 }] },
				controller,
			}),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(controller.generateFeed).not.toHaveBeenCalled();
	});

	it("retries fail closed until immutable published Catalog derivation exists", async () => {
		const controller = makeController();
		const request = () =>
			call(generateFeedHandler, {
				params: { id: "feed_1" },
				body: {},
				controller,
			});

		await expect(request()).resolves.toEqual({
			code: "PRODUCT_FEED_GENERATION_REVIEW_REQUIRED",
			error:
				"Product feed generation is unavailable until it reads an immutable published Catalog revision.",
			status: 503,
		});
		await expect(request()).resolves.toMatchObject({
			code: "PRODUCT_FEED_GENERATION_REVIEW_REQUIRED",
			status: 503,
		});
		expect(controller.generateFeed).not.toHaveBeenCalled();
	});
});

describe("admin GET /product-feeds/:id/items", () => {
	it("returns empty list", async () => {
		const result = (await call(getFeedItemsHandler, {
			params: { id: "feed_1" },
		})) as { items: FeedItem[]; total: number };
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns feed items", async () => {
		const items = [
			makeFeedItem({ feedId: "feed_1" }),
			makeFeedItem({ feedId: "feed_1", status: "warning" }),
		];
		const ctrl = makeController({
			getFeedItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(getFeedItemsHandler, {
			params: { id: "feed_1" },
			controller: ctrl,
		})) as { items: FeedItem[]; total: number };
		expect(result.items).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

describe("admin POST /product-feeds/:id/validate", () => {
	it("returns valid with no issues", async () => {
		const result = (await call(validateFeedHandler, {
			params: { id: "feed_1" },
			body: {},
		})) as { valid: boolean; issues: FeedItemIssue[] };
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("returns invalid when errors exist", async () => {
		const issues: FeedItemIssue[] = [
			{ field: "price", severity: "error", message: "Missing price" },
			{ field: "title", severity: "warning", message: "Title too long" },
		];
		const ctrl = makeController({
			validateFeed: vi.fn().mockResolvedValue(issues),
		});
		const result = (await call(validateFeedHandler, {
			params: { id: "feed_1" },
			body: {},
			controller: ctrl,
		})) as { valid: boolean; issues: FeedItemIssue[] };
		expect(result.valid).toBe(false);
		expect(result.issues).toHaveLength(2);
	});
});

describe("admin GET /product-feeds/:id/mappings", () => {
	it("returns empty list", async () => {
		const result = (await call(listMappingsHandler, {
			params: { id: "feed_1" },
		})) as { mappings: CategoryMapping[]; total: number };
		expect(result.mappings).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns mappings for feed", async () => {
		const mappings = [
			makeMapping({ feedId: "feed_1" }),
			makeMapping({ feedId: "feed_1", storeCategory: "Apparel" }),
		];
		const ctrl = makeController({
			listCategoryMappings: vi.fn().mockResolvedValue(mappings),
		});
		const result = (await call(listMappingsHandler, {
			params: { id: "feed_1" },
			controller: ctrl,
		})) as { mappings: CategoryMapping[]; total: number };
		expect(result.mappings).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

describe("admin POST /product-feeds/:id/mappings/create", () => {
	it("adds a category mapping and returns it", async () => {
		const mapping = makeMapping({
			storeCategory: "Books",
			channelCategory: "Media > Books",
		});
		const ctrl = makeController({
			addCategoryMapping: vi.fn().mockResolvedValue(mapping),
		});
		const result = (await call(addMappingHandler, {
			params: { id: "feed_1" },
			body: {
				storeCategory: "Books",
				channelCategory: "Media > Books",
			},
			controller: ctrl,
		})) as { mapping: CategoryMapping };
		expect(result.mapping.storeCategory).toBe("Books");
		expect(result.mapping.channelCategory).toBe("Media > Books");
	});
});

describe("admin POST /product-feeds/:id/mappings/:mappingId/delete", () => {
	it("returns error when not found", async () => {
		const result = (await call(deleteMappingHandler, {
			params: { id: "feed_1", mappingId: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("deletes mapping and returns success", async () => {
		const ctrl = makeController({
			deleteCategoryMapping: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteMappingHandler, {
			params: { id: "feed_1", mappingId: "map_1" },
			body: {},
			controller: ctrl,
		})) as { success: true };
		expect(result.success).toBe(true);
	});
});
