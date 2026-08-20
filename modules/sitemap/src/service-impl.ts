import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	MAX_ENTRIES_PER_SITEMAP,
	type SitemapConfig,
	type SitemapController,
	type SitemapEntry,
} from "./service";

const CONFIG_ID = "default";

const DEFAULT_CONFIG: Omit<SitemapConfig, "id" | "createdAt" | "updatedAt"> = {
	baseUrl: "https://example.com",
	includeProducts: true,
	includeCollections: true,
	includePages: true,
	includeBlog: true,
	includeBrands: true,
	defaultChangeFreq: "weekly",
	defaultPriority: 0.5,
	productChangeFreq: "weekly",
	productPriority: 0.8,
	collectionChangeFreq: "weekly",
	collectionPriority: 0.7,
	pageChangeFreq: "monthly",
	pagePriority: 0.6,
	blogChangeFreq: "weekly",
	blogPriority: 0.6,
};

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function formatDate(date: Date): string {
	return date.toISOString().split("T")[0];
}

export function createSitemapController(
	data: ModuleDataService,
): SitemapController {
	return {
		async getConfig() {
			const raw = await data.get("sitemapConfig", CONFIG_ID);
			if (raw) return raw as unknown as SitemapConfig;

			// Create default config on first access
			const now = new Date();
			const config: SitemapConfig = {
				id: CONFIG_ID,
				...DEFAULT_CONFIG,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"sitemapConfig",
				CONFIG_ID,
				config as Record<string, unknown>,
			);
			return config;
		},

		async updateConfig(params) {
			const existing = await this.getConfig();

			const updated: SitemapConfig = {
				...existing,
				...Object.fromEntries(
					Object.entries(params).filter(([_, v]) => v !== undefined),
				),
				id: CONFIG_ID,
				createdAt: existing.createdAt,
				updatedAt: new Date(),
			};

			await data.upsert(
				"sitemapConfig",
				CONFIG_ID,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async addEntry(params) {
			const config = await this.getConfig();
			const id = crypto.randomUUID();
			const entry: SitemapEntry = {
				id,
				loc: `${config.baseUrl.replace(/\/$/, "")}${params.path}`,
				changefreq: params.changefreq ?? config.defaultChangeFreq,
				priority: params.priority ?? config.defaultPriority,
				source: "custom",
				createdAt: new Date(),
				...(params.lastmod != null && { lastmod: params.lastmod }),
			};
			await data.upsert("sitemapEntry", id, entry as Record<string, unknown>);
			return entry;
		},

		async getEntry(id) {
			const raw = await data.get("sitemapEntry", id);
			if (!raw) return null;
			return raw as unknown as SitemapEntry;
		},

		async getEntryByLoc(loc) {
			const entries = (await data.findMany("sitemapEntry", {
				where: { loc },
			})) as unknown as SitemapEntry[];
			return entries[0] ?? null;
		},

		async updateEntry(id, params) {
			const existing = await data.get("sitemapEntry", id);
			if (!existing) return null;

			const entry = existing as unknown as SitemapEntry;
			const config = await this.getConfig();
			const baseUrl = config.baseUrl.replace(/\/$/, "");

			const updated: SitemapEntry = {
				...entry,
				...(params.path != null && { loc: `${baseUrl}${params.path}` }),
				...(params.changefreq != null && { changefreq: params.changefreq }),
				...(params.priority != null && { priority: params.priority }),
				...(params.lastmod != null && { lastmod: params.lastmod }),
			};

			await data.upsert("sitemapEntry", id, updated as Record<string, unknown>);
			return updated;
		},

		async removeEntry(id) {
			const existing = await data.get("sitemapEntry", id);
			if (!existing) return false;
			await data.delete("sitemapEntry", id);
			return true;
		},

		async bulkAddEntries(entries) {
			const results: SitemapEntry[] = [];
			for (const params of entries) {
				const entry = await this.addEntry(params);
				results.push(entry);
			}
			return results;
		},

		async bulkRemoveEntries(ids) {
			let removed = 0;
			for (const id of ids) {
				const success = await this.removeEntry(id);
				if (success) removed++;
			}
			return removed;
		},

		async listEntries(params) {
			const where: Record<string, unknown> = {};
			if (params?.source) where.source = params.source;

			return (await data.findMany(
				"sitemapEntry",
				buildFindOptions({
					where,
					orderBy: { loc: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as SitemapEntry[];
		},

		async countEntries(source) {
			const where: Record<string, unknown> = {};
			if (source) where.source = source;

			const results = (await data.findMany("sitemapEntry", {
				where,
			})) as unknown as SitemapEntry[];
			return results.length;
		},

		async generateXml(page) {
			const allEntries = (await data.findMany(
				"sitemapEntry",
				buildFindOptions({ orderBy: { loc: "asc" } }),
			)) as unknown as SitemapEntry[];

			let entries: SitemapEntry[];
			if (page != null && allEntries.length > MAX_ENTRIES_PER_SITEMAP) {
				const start = page * MAX_ENTRIES_PER_SITEMAP;
				entries = allEntries.slice(start, start + MAX_ENTRIES_PER_SITEMAP);
			} else {
				entries = allEntries;
			}

			const lines: string[] = [
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
			];

			for (const entry of entries) {
				lines.push("  <url>");
				lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
				if (entry.lastmod) {
					lines.push(`    <lastmod>${formatDate(entry.lastmod)}</lastmod>`);
				}
				lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
				lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
				lines.push("  </url>");
			}

			lines.push("</urlset>");
			return lines.join("\n");
		},

		async generateSitemapIndex() {
			const totalEntries = await this.countEntries();
			if (totalEntries <= MAX_ENTRIES_PER_SITEMAP) return null;

			const config = await this.getConfig();
			const baseUrl = config.baseUrl.replace(/\/$/, "");
			const pageCount = Math.ceil(totalEntries / MAX_ENTRIES_PER_SITEMAP);
			const now = formatDate(new Date());

			const lines: string[] = [
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
			];

			for (let i = 0; i < pageCount; i++) {
				lines.push("  <sitemap>");
				lines.push(
					`    <loc>${escapeXml(`${baseUrl}/sitemap-${i}.xml`)}</loc>`,
				);
				lines.push(`    <lastmod>${now}</lastmod>`);
				lines.push("  </sitemap>");
			}

			lines.push("</sitemapindex>");
			return lines.join("\n");
		},

		async regenerate(pages) {
			const config = await this.getConfig();
			const baseUrl = config.baseUrl.replace(/\/$/, "");

			// Remove all auto-generated entries (keep custom)
			const existing = (await data.findMany(
				"sitemapEntry",
				{},
			)) as unknown as SitemapEntry[];
			for (const entry of existing) {
				if (entry.source !== "custom") {
					await data.delete("sitemapEntry", entry.id);
				}
			}

			let count = 0;
			const excludedPaths = config.excludedPaths ?? [];

			function isExcluded(path: string): boolean {
				return excludedPaths.some(
					(excluded) => path === excluded || path.startsWith(`${excluded}/`),
				);
			}

			// Add homepage
			if (!isExcluded("/")) {
				const id = crypto.randomUUID();
				const entry: SitemapEntry = {
					id,
					loc: baseUrl,
					changefreq: config.defaultChangeFreq,
					priority: 1.0,
					source: "static",
					createdAt: new Date(),
				};
				await data.upsert("sitemapEntry", id, entry as Record<string, unknown>);
				count++;
			}

			// Products
			if (config.includeProducts && pages.products) {
				for (const product of pages.products) {
					const path = `/products/${product.slug}`;
					if (isExcluded(path)) continue;
					const id = crypto.randomUUID();
					const entry: SitemapEntry = {
						id,
						loc: `${baseUrl}${path}`,
						changefreq: config.productChangeFreq,
						priority: config.productPriority,
						source: "product",
						sourceId: product.slug,
						createdAt: new Date(),
						...(product.updatedAt != null && {
							lastmod: product.updatedAt,
						}),
					};
					await data.upsert(
						"sitemapEntry",
						id,
						entry as Record<string, unknown>,
					);
					count++;
				}
			}

			// Collections
			if (config.includeCollections && pages.collections) {
				for (const collection of pages.collections) {
					const path = `/collections/${collection.slug}`;
					if (isExcluded(path)) continue;
					const id = crypto.randomUUID();
					const entry: SitemapEntry = {
						id,
						loc: `${baseUrl}${path}`,
						changefreq: config.collectionChangeFreq,
						priority: config.collectionPriority,
						source: "collection",
						sourceId: collection.slug,
						createdAt: new Date(),
						...(collection.updatedAt != null && {
							lastmod: collection.updatedAt,
						}),
					};
					await data.upsert(
						"sitemapEntry",
						id,
						entry as Record<string, unknown>,
					);
					count++;
				}
			}

			// Pages
			if (config.includePages && pages.pages) {
				for (const page of pages.pages) {
					const path = `/${page.slug}`;
					if (isExcluded(path)) continue;
					const id = crypto.randomUUID();
					const entry: SitemapEntry = {
						id,
						loc: `${baseUrl}${path}`,
						changefreq: config.pageChangeFreq,
						priority: config.pagePriority,
						source: "page",
						sourceId: page.slug,
						createdAt: new Date(),
						...(page.updatedAt != null && { lastmod: page.updatedAt }),
					};
					await data.upsert(
						"sitemapEntry",
						id,
						entry as Record<string, unknown>,
					);
					count++;
				}
			}

			// Blog
			if (config.includeBlog && pages.blog) {
				for (const post of pages.blog) {
					const path = `/blog/${post.slug}`;
					if (isExcluded(path)) continue;
					const id = crypto.randomUUID();
					const entry: SitemapEntry = {
						id,
						loc: `${baseUrl}${path}`,
						changefreq: config.blogChangeFreq,
						priority: config.blogPriority,
						source: "blog",
						sourceId: post.slug,
						createdAt: new Date(),
						...(post.updatedAt != null && { lastmod: post.updatedAt }),
					};
					await data.upsert(
						"sitemapEntry",
						id,
						entry as Record<string, unknown>,
					);
					count++;
				}
			}

			// Brands
			if (config.includeBrands && pages.brands) {
				for (const brand of pages.brands) {
					const path = `/brands/${brand.slug}`;
					if (isExcluded(path)) continue;
					const id = crypto.randomUUID();
					const entry: SitemapEntry = {
						id,
						loc: `${baseUrl}${path}`,
						changefreq: config.defaultChangeFreq,
						priority: config.defaultPriority,
						source: "brand",
						sourceId: brand.slug,
						createdAt: new Date(),
						...(brand.updatedAt != null && { lastmod: brand.updatedAt }),
					};
					await data.upsert(
						"sitemapEntry",
						id,
						entry as Record<string, unknown>,
					);
					count++;
				}
			}

			// Update config lastGenerated
			await this.updateConfig({});
			const cfg = await this.getConfig();
			await data.upsert("sitemapConfig", CONFIG_ID, {
				...cfg,
				lastGenerated: new Date(),
			} as Record<string, unknown>);

			return count;
		},

		async getStats() {
			const config = await this.getConfig();
			const entries = (await data.findMany(
				"sitemapEntry",
				{},
			)) as unknown as SitemapEntry[];

			const entriesBySource: Record<string, number> = {};
			for (const entry of entries) {
				entriesBySource[entry.source] =
					(entriesBySource[entry.source] ?? 0) + 1;
			}

			const result: {
				totalEntries: number;
				entriesBySource: Record<string, number>;
				lastGenerated?: Date;
			} = {
				totalEntries: entries.length,
				entriesBySource,
			};
			if (config.lastGenerated != null) {
				result.lastGenerated = config.lastGenerated;
			}
			return result;
		},
	};
}
