import { describe, expect, it, vi } from "vitest";
import { addEntry } from "../admin/endpoints/add-entry";
import { bulkAddEntries } from "../admin/endpoints/bulk-add";
import { bulkRemoveEntries } from "../admin/endpoints/bulk-remove";
import { getConfig } from "../admin/endpoints/get-config";
import { getEntry } from "../admin/endpoints/get-entry";
import { getStats } from "../admin/endpoints/get-stats";
import { listEntries } from "../admin/endpoints/list-entries";
import { previewSitemap } from "../admin/endpoints/preview";
import { regenerateSitemap } from "../admin/endpoints/regenerate";
import { removeEntry } from "../admin/endpoints/remove-entry";
import { updateConfig } from "../admin/endpoints/update-config";
import { updateEntry } from "../admin/endpoints/update-entry";
import type {
	ChangeFreq,
	SitemapConfig,
	SitemapController,
	SitemapEntry,
	SitemapStats,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeEntry(overrides: Partial<SitemapEntry> = {}): SitemapEntry {
	return {
		id: crypto.randomUUID(),
		loc: "https://example.com/products/widget",
		changefreq: "weekly" as ChangeFreq,
		priority: 0.8,
		source: "custom",
		createdAt: new Date(),
		...overrides,
	} satisfies SitemapEntry;
}

function makeConfig(overrides: Partial<SitemapConfig> = {}): SitemapConfig {
	const now = new Date();
	return {
		id: "default",
		baseUrl: "https://example.com",
		includeProducts: true,
		includeCollections: true,
		includePages: true,
		includeBlog: true,
		includeBrands: true,
		defaultChangeFreq: "weekly" as ChangeFreq,
		defaultPriority: 0.5,
		productChangeFreq: "weekly" as ChangeFreq,
		productPriority: 0.8,
		collectionChangeFreq: "weekly" as ChangeFreq,
		collectionPriority: 0.7,
		pageChangeFreq: "monthly" as ChangeFreq,
		pagePriority: 0.6,
		blogChangeFreq: "weekly" as ChangeFreq,
		blogPriority: 0.6,
		createdAt: now,
		updatedAt: now,
		...overrides,
	} satisfies SitemapConfig;
}

function makeController(
	overrides: Partial<SitemapController> = {},
): SitemapController {
	return {
		getConfig: vi.fn().mockResolvedValue(makeConfig()),
		updateConfig: vi.fn().mockResolvedValue(makeConfig()),
		addEntry: vi.fn().mockResolvedValue(makeEntry()),
		getEntry: vi.fn().mockResolvedValue(null),
		getEntryByLoc: vi.fn().mockResolvedValue(null),
		updateEntry: vi.fn().mockResolvedValue(null),
		removeEntry: vi.fn().mockResolvedValue(false),
		bulkAddEntries: vi.fn().mockResolvedValue([]),
		bulkRemoveEntries: vi.fn().mockResolvedValue(0),
		listEntries: vi.fn().mockResolvedValue([]),
		countEntries: vi.fn().mockResolvedValue(0),
		generateXml: vi
			.fn()
			.mockResolvedValue(
				'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
			),
		generateSitemapIndex: vi.fn().mockResolvedValue(null),
		regenerate: vi.fn().mockResolvedValue(0),
		getStats: vi.fn().mockResolvedValue({
			totalEntries: 0,
			entriesBySource: {},
		} satisfies SitemapStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SitemapController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { sitemap: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const addEntryHandler = extractHandler(addEntry);
const bulkAddHandler = extractHandler(bulkAddEntries);
const bulkRemoveHandler = extractHandler(bulkRemoveEntries);
const getConfigHandler = extractHandler(getConfig);
const getEntryHandler = extractHandler(getEntry);
const getStatsHandler = extractHandler(getStats);
const listEntriesHandler = extractHandler(listEntries);
const previewHandler = extractHandler(previewSitemap);
const regenerateHandler = extractHandler(regenerateSitemap);
const removeEntryHandler = extractHandler(removeEntry);
const updateConfigHandler = extractHandler(updateConfig);
const updateEntryHandler = extractHandler(updateEntry);

// ── addEntry ──────────────────────────────────────────────────────────────────

describe("admin POST /sitemap/entries/add", () => {
	it("creates an entry and returns it", async () => {
		const entry = makeEntry({ loc: "https://example.com/about" });
		const ctrl = makeController({
			addEntry: vi.fn().mockResolvedValue(entry),
		});
		const result = (await call(addEntryHandler, {
			body: { path: "/about" },
			controller: ctrl,
		})) as { entry: SitemapEntry };
		expect(result.entry.loc).toBe("https://example.com/about");
		expect(ctrl.addEntry).toHaveBeenCalledWith(
			expect.objectContaining({ path: "/about" }),
		);
	});

	it("forwards changefreq and priority to controller", async () => {
		const entry = makeEntry({ changefreq: "daily", priority: 0.9 });
		const ctrl = makeController({
			addEntry: vi.fn().mockResolvedValue(entry),
		});
		const result = (await call(addEntryHandler, {
			body: { path: "/sale", changefreq: "daily", priority: 0.9 },
			controller: ctrl,
		})) as { entry: SitemapEntry };
		expect(result.entry.changefreq).toBe("daily");
		expect(result.entry.priority).toBe(0.9);
		expect(ctrl.addEntry).toHaveBeenCalledWith(
			expect.objectContaining({ changefreq: "daily", priority: 0.9 }),
		);
	});

	it("omits optional fields when not provided", async () => {
		const ctrl = makeController();
		await call(addEntryHandler, {
			body: { path: "/minimal" },
			controller: ctrl,
		});
		const callArg = (ctrl.addEntry as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(callArg.changefreq).toBeUndefined();
		expect(callArg.priority).toBeUndefined();
	});
});

// ── bulkAddEntries ────────────────────────────────────────────────────────────

describe("admin POST /sitemap/entries/bulk-add", () => {
	it("creates multiple entries and returns them with count", async () => {
		const entries = [
			makeEntry({ loc: "https://example.com/a" }),
			makeEntry({ loc: "https://example.com/b" }),
		];
		const ctrl = makeController({
			bulkAddEntries: vi.fn().mockResolvedValue(entries),
		});
		const result = (await call(bulkAddHandler, {
			body: {
				entries: [{ path: "/a" }, { path: "/b" }],
			},
			controller: ctrl,
		})) as { entries: SitemapEntry[]; count: number };
		expect(result.entries).toHaveLength(2);
		expect(result.count).toBe(2);
		expect(ctrl.bulkAddEntries).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ path: "/a" }),
				expect.objectContaining({ path: "/b" }),
			]),
		);
	});

	it("forwards per-entry changefreq and priority", async () => {
		const entries = [makeEntry({ changefreq: "monthly", priority: 0.4 })];
		const ctrl = makeController({
			bulkAddEntries: vi.fn().mockResolvedValue(entries),
		});
		await call(bulkAddHandler, {
			body: {
				entries: [{ path: "/promo", changefreq: "monthly", priority: 0.4 }],
			},
			controller: ctrl,
		});
		expect(ctrl.bulkAddEntries).toHaveBeenCalledWith([
			expect.objectContaining({ changefreq: "monthly", priority: 0.4 }),
		]);
	});

	it("returns count equal to entries array length", async () => {
		const three = [makeEntry(), makeEntry(), makeEntry()];
		const ctrl = makeController({
			bulkAddEntries: vi.fn().mockResolvedValue(three),
		});
		const result = (await call(bulkAddHandler, {
			body: {
				entries: [{ path: "/x" }, { path: "/y" }, { path: "/z" }],
			},
			controller: ctrl,
		})) as { count: number };
		expect(result.count).toBe(3);
	});
});

// ── bulkRemoveEntries ─────────────────────────────────────────────────────────

describe("admin POST /sitemap/entries/bulk-remove", () => {
	it("removes entries and returns removed count", async () => {
		const ctrl = makeController({
			bulkRemoveEntries: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(bulkRemoveHandler, {
			body: { ids: ["id-1", "id-2"] },
			controller: ctrl,
		})) as { removed: number };
		expect(result.removed).toBe(2);
		expect(ctrl.bulkRemoveEntries).toHaveBeenCalledWith(["id-1", "id-2"]);
	});

	it("returns zero when no entries are found", async () => {
		const ctrl = makeController({
			bulkRemoveEntries: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(bulkRemoveHandler, {
			body: { ids: ["nonexistent-1", "nonexistent-2"] },
			controller: ctrl,
		})) as { removed: number };
		expect(result.removed).toBe(0);
	});

	it("passes all IDs to controller", async () => {
		const ctrl = makeController({
			bulkRemoveEntries: vi.fn().mockResolvedValue(3),
		});
		await call(bulkRemoveHandler, {
			body: { ids: ["a", "b", "c"] },
			controller: ctrl,
		});
		expect(ctrl.bulkRemoveEntries).toHaveBeenCalledWith(["a", "b", "c"]);
	});
});

// ── getConfig ─────────────────────────────────────────────────────────────────

describe("admin GET /sitemap/config", () => {
	it("returns the sitemap configuration", async () => {
		const config = makeConfig({ baseUrl: "https://mystore.com" });
		const ctrl = makeController({
			getConfig: vi.fn().mockResolvedValue(config),
		});
		const result = (await call(getConfigHandler, {
			controller: ctrl,
		})) as { config: SitemapConfig };
		expect(result.config.baseUrl).toBe("https://mystore.com");
		expect(result.config.includeProducts).toBe(true);
	});

	it("returns config with all required fields", async () => {
		const result = (await call(getConfigHandler)) as { config: SitemapConfig };
		expect(result.config).toHaveProperty("id");
		expect(result.config).toHaveProperty("baseUrl");
		expect(result.config).toHaveProperty("defaultChangeFreq");
		expect(result.config).toHaveProperty("defaultPriority");
		expect(result.config).toHaveProperty("createdAt");
		expect(result.config).toHaveProperty("updatedAt");
	});
});

// ── getEntry ──────────────────────────────────────────────────────────────────

describe("admin GET /sitemap/entries/:id", () => {
	it("returns 404 when entry not found", async () => {
		const result = (await call(getEntryHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Entry not found");
	});

	it("returns entry when found", async () => {
		const entry = makeEntry({ id: "e1", loc: "https://example.com/contact" });
		const ctrl = makeController({
			getEntry: vi.fn().mockResolvedValue(entry),
		});
		const result = (await call(getEntryHandler, {
			params: { id: "e1" },
			controller: ctrl,
		})) as { entry: SitemapEntry };
		expect(result.entry.id).toBe("e1");
		expect(result.entry.loc).toBe("https://example.com/contact");
		expect(ctrl.getEntry).toHaveBeenCalledWith("e1");
	});

	it("passes the ID from params to controller", async () => {
		const entry = makeEntry({ id: "e2" });
		const ctrl = makeController({
			getEntry: vi.fn().mockResolvedValue(entry),
		});
		await call(getEntryHandler, { params: { id: "e2" }, controller: ctrl });
		expect(ctrl.getEntry).toHaveBeenCalledWith("e2");
	});
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe("admin GET /sitemap/stats", () => {
	it("returns stats with totalEntries and entriesBySource", async () => {
		const stats: SitemapStats = {
			totalEntries: 42,
			entriesBySource: { product: 20, custom: 10, static: 12 },
			lastGenerated: new Date(),
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(getStatsHandler, {
			controller: ctrl,
		})) as { stats: SitemapStats };
		expect(result.stats.totalEntries).toBe(42);
		expect(result.stats.entriesBySource.product).toBe(20);
		expect(result.stats.entriesBySource.custom).toBe(10);
	});

	it("returns zero-state stats when no entries exist", async () => {
		const result = (await call(getStatsHandler)) as { stats: SitemapStats };
		expect(result.stats.totalEntries).toBe(0);
		expect(result.stats.entriesBySource).toEqual({});
	});
});

// ── listEntries ───────────────────────────────────────────────────────────────

describe("admin GET /sitemap/entries", () => {
	it("returns empty list when no entries exist", async () => {
		const result = (await call(listEntriesHandler)) as {
			entries: SitemapEntry[];
			total: number;
		};
		expect(result.entries).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns entries and total count", async () => {
		const entries = [makeEntry(), makeEntry()];
		const ctrl = makeController({
			listEntries: vi.fn().mockResolvedValue(entries),
			countEntries: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listEntriesHandler, {
			controller: ctrl,
		})) as { entries: SitemapEntry[]; total: number };
		expect(result.entries).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes source filter from query to controller", async () => {
		const ctrl = makeController({
			listEntries: vi.fn().mockResolvedValue([]),
			countEntries: vi.fn().mockResolvedValue(0),
		});
		await call(listEntriesHandler, {
			query: { source: "product" },
			controller: ctrl,
		});
		expect(ctrl.listEntries).toHaveBeenCalledWith(
			expect.objectContaining({ source: "product" }),
		);
		expect(ctrl.countEntries).toHaveBeenCalledWith("product");
	});

	it("uses default take=50 and skip=0 when not specified", async () => {
		const ctrl = makeController({
			listEntries: vi.fn().mockResolvedValue([]),
			countEntries: vi.fn().mockResolvedValue(0),
		});
		await call(listEntriesHandler, { controller: ctrl });
		expect(ctrl.listEntries).toHaveBeenCalledWith(
			expect.objectContaining({ take: 50, skip: 0 }),
		);
	});

	it("respects explicit take and skip query params", async () => {
		const ctrl = makeController({
			listEntries: vi.fn().mockResolvedValue([]),
			countEntries: vi.fn().mockResolvedValue(0),
		});
		await call(listEntriesHandler, {
			query: { take: "10", skip: "20" },
			controller: ctrl,
		});
		expect(ctrl.listEntries).toHaveBeenCalledWith(
			expect.objectContaining({ take: 10, skip: 20 }),
		);
	});
});

// ── previewSitemap ────────────────────────────────────────────────────────────

describe("admin GET /sitemap/preview", () => {
	it("returns XML string from generateXml", async () => {
		const xml =
			'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>';
		const ctrl = makeController({
			generateXml: vi.fn().mockResolvedValue(xml),
		});
		const result = (await call(previewHandler, {
			controller: ctrl,
		})) as { xml: string };
		expect(result.xml).toContain("<?xml");
		expect(result.xml).toContain("https://example.com/");
	});

	it("returns empty urlset when no entries", async () => {
		const result = (await call(previewHandler)) as { xml: string };
		expect(result.xml).toContain("<?xml");
		expect(result.xml).toContain("urlset");
	});
});

// ── regenerateSitemap ─────────────────────────────────────────────────────────

describe("admin POST /sitemap/regenerate", () => {
	it("returns entriesGenerated count from controller", async () => {
		const ctrl = makeController({
			regenerate: vi.fn().mockResolvedValue(5),
		});
		const result = (await call(regenerateHandler, {
			body: { products: [{ slug: "widget" }] },
			controller: ctrl,
		})) as { entriesGenerated: number };
		expect(result.entriesGenerated).toBe(5);
		expect(ctrl.regenerate).toHaveBeenCalledWith(
			expect.objectContaining({ products: [{ slug: "widget" }] }),
		);
	});

	it("regenerates with all source types", async () => {
		const ctrl = makeController({
			regenerate: vi.fn().mockResolvedValue(10),
		});
		const result = (await call(regenerateHandler, {
			body: {
				products: [{ slug: "prod-1" }],
				collections: [{ slug: "col-1" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "post-1" }],
				brands: [{ slug: "brand-1" }],
			},
			controller: ctrl,
		})) as { entriesGenerated: number };
		expect(result.entriesGenerated).toBe(10);
		expect(ctrl.regenerate).toHaveBeenCalledWith(
			expect.objectContaining({
				products: [{ slug: "prod-1" }],
				collections: [{ slug: "col-1" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "post-1" }],
				brands: [{ slug: "brand-1" }],
			}),
		);
	});

	it("returns zero when no sources are provided", async () => {
		const ctrl = makeController({
			regenerate: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(regenerateHandler, {
			body: {},
			controller: ctrl,
		})) as { entriesGenerated: number };
		expect(result.entriesGenerated).toBe(0);
	});

	it("forwards updatedAt for entries that have it", async () => {
		const updatedAt = new Date("2025-01-15");
		const ctrl = makeController({
			regenerate: vi.fn().mockResolvedValue(1),
		});
		await call(regenerateHandler, {
			body: {
				products: [{ slug: "dated-prod", updatedAt: updatedAt.toISOString() }],
			},
			controller: ctrl,
		});
		const callArg = (ctrl.regenerate as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(callArg.products[0].slug).toBe("dated-prod");
		expect(callArg.products[0].updatedAt).toBeInstanceOf(Date);
	});
});

// ── removeEntry ───────────────────────────────────────────────────────────────

describe("admin POST /sitemap/entries/:id/remove", () => {
	it("returns 404 when entry not found", async () => {
		const result = (await call(removeEntryHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Entry not found");
	});

	it("returns success:true when entry is removed", async () => {
		const ctrl = makeController({
			removeEntry: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeEntryHandler, {
			params: { id: "e3" },
			controller: ctrl,
		})) as { success: true };
		expect(result.success).toBe(true);
		expect(ctrl.removeEntry).toHaveBeenCalledWith("e3");
	});

	it("calls controller with the correct ID", async () => {
		const ctrl = makeController({
			removeEntry: vi.fn().mockResolvedValue(true),
		});
		await call(removeEntryHandler, {
			params: { id: "target-id" },
			controller: ctrl,
		});
		expect(ctrl.removeEntry).toHaveBeenCalledWith("target-id");
	});
});

// ── updateConfig ──────────────────────────────────────────────────────────────

describe("admin POST /sitemap/config/update", () => {
	it("returns updated config", async () => {
		const updated = makeConfig({
			baseUrl: "https://newsite.com",
			defaultChangeFreq: "daily",
		});
		const ctrl = makeController({
			updateConfig: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateConfigHandler, {
			body: { baseUrl: "https://newsite.com", defaultChangeFreq: "daily" },
			controller: ctrl,
		})) as { config: SitemapConfig };
		expect(result.config.baseUrl).toBe("https://newsite.com");
		expect(result.config.defaultChangeFreq).toBe("daily");
	});

	it("forwards all optional fields to controller", async () => {
		const ctrl = makeController();
		await call(updateConfigHandler, {
			body: {
				includeProducts: false,
				includeBlog: false,
				productPriority: 0.9,
				blogChangeFreq: "daily",
				excludedPaths: ["/admin", "/api"],
			},
			controller: ctrl,
		});
		expect(ctrl.updateConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				includeProducts: false,
				includeBlog: false,
				productPriority: 0.9,
				blogChangeFreq: "daily",
				excludedPaths: ["/admin", "/api"],
			}),
		);
	});

	it("handles partial update with a single field", async () => {
		const updated = makeConfig({ defaultPriority: 0.3 });
		const ctrl = makeController({
			updateConfig: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateConfigHandler, {
			body: { defaultPriority: 0.3 },
			controller: ctrl,
		})) as { config: SitemapConfig };
		expect(result.config.defaultPriority).toBe(0.3);
		expect(ctrl.updateConfig).toHaveBeenCalledWith(
			expect.objectContaining({ defaultPriority: 0.3 }),
		);
	});
});

// ── updateEntry ───────────────────────────────────────────────────────────────

describe("admin POST /sitemap/entries/:id/update", () => {
	it("returns 404 when entry not found", async () => {
		const result = (await call(updateEntryHandler, {
			params: { id: "nonexistent" },
			body: { priority: 0.5 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Entry not found");
	});

	it("returns updated entry on success", async () => {
		const updated = makeEntry({ id: "e4", priority: 0.3 });
		const ctrl = makeController({
			updateEntry: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateEntryHandler, {
			params: { id: "e4" },
			body: { priority: 0.3 },
			controller: ctrl,
		})) as { entry: SitemapEntry };
		expect(result.entry.id).toBe("e4");
		expect(result.entry.priority).toBe(0.3);
		expect(ctrl.updateEntry).toHaveBeenCalledWith(
			"e4",
			expect.objectContaining({ priority: 0.3 }),
		);
	});

	it("forwards path update to controller", async () => {
		const updated = makeEntry({
			id: "e5",
			loc: "https://example.com/new-path",
		});
		const ctrl = makeController({
			updateEntry: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateEntryHandler, {
			params: { id: "e5" },
			body: { path: "/new-path" },
			controller: ctrl,
		})) as { entry: SitemapEntry };
		expect(result.entry.loc).toBe("https://example.com/new-path");
		expect(ctrl.updateEntry).toHaveBeenCalledWith(
			"e5",
			expect.objectContaining({ path: "/new-path" }),
		);
	});

	it("forwards changefreq update to controller", async () => {
		const updated = makeEntry({ changefreq: "monthly" });
		const ctrl = makeController({
			updateEntry: vi.fn().mockResolvedValue(updated),
		});
		await call(updateEntryHandler, {
			params: { id: "e6" },
			body: { changefreq: "monthly" },
			controller: ctrl,
		});
		expect(ctrl.updateEntry).toHaveBeenCalledWith(
			"e6",
			expect.objectContaining({ changefreq: "monthly" }),
		);
	});
});
