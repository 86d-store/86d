import type { ModuleController } from "@86d-app/core/types/module";

export type ChangeFreq =
	| "always"
	| "hourly"
	| "daily"
	| "weekly"
	| "monthly"
	| "yearly"
	| "never";

export type SitemapConfig = {
	id: string;
	baseUrl: string;
	includeProducts: boolean;
	includeCollections: boolean;
	includePages: boolean;
	includeBlog: boolean;
	includeBrands: boolean;
	defaultChangeFreq: ChangeFreq;
	defaultPriority: number;
	productChangeFreq: ChangeFreq;
	productPriority: number;
	collectionChangeFreq: ChangeFreq;
	collectionPriority: number;
	pageChangeFreq: ChangeFreq;
	pagePriority: number;
	blogChangeFreq: ChangeFreq;
	blogPriority: number;
	excludedPaths?: string[];
	lastGenerated?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type SitemapEntry = {
	id: string;
	/** Full URL */
	loc: string;
	lastmod?: Date;
	changefreq: ChangeFreq;
	priority: number;
	/** Source type: product, collection, page, blog, brand, static, custom */
	source: string;
	/** ID of source record (if applicable) */
	sourceId?: string;
	createdAt: Date;
};

export type SitemapStats = {
	totalEntries: number;
	entriesBySource: Record<string, number>;
	lastGenerated?: Date;
};

/** Maximum URLs per sitemap file (per sitemaps.org spec: 50,000) */
export const MAX_ENTRIES_PER_SITEMAP = 50_000;

export type SitemapController = ModuleController & {
	getConfig(): Promise<SitemapConfig>;

	updateConfig(params: {
		baseUrl?: string;
		includeProducts?: boolean;
		includeCollections?: boolean;
		includePages?: boolean;
		includeBlog?: boolean;
		includeBrands?: boolean;
		defaultChangeFreq?: ChangeFreq;
		defaultPriority?: number;
		productChangeFreq?: ChangeFreq;
		productPriority?: number;
		collectionChangeFreq?: ChangeFreq;
		collectionPriority?: number;
		pageChangeFreq?: ChangeFreq;
		pagePriority?: number;
		blogChangeFreq?: ChangeFreq;
		blogPriority?: number;
		excludedPaths?: string[];
	}): Promise<SitemapConfig>;

	/**
	 * Add a custom sitemap entry (for pages not auto-discovered).
	 */
	addEntry(params: {
		path: string;
		changefreq?: ChangeFreq;
		priority?: number;
		lastmod?: Date;
	}): Promise<SitemapEntry>;

	/**
	 * Get a single entry by ID.
	 */
	getEntry(id: string): Promise<SitemapEntry | null>;

	/**
	 * Find an entry by its full URL (loc).
	 */
	getEntryByLoc(loc: string): Promise<SitemapEntry | null>;

	/**
	 * Update a custom sitemap entry.
	 */
	updateEntry(
		id: string,
		params: {
			path?: string;
			changefreq?: ChangeFreq;
			priority?: number;
			lastmod?: Date;
		},
	): Promise<SitemapEntry | null>;

	/**
	 * Remove a custom sitemap entry.
	 */
	removeEntry(id: string): Promise<boolean>;

	/**
	 * Add multiple custom entries at once. Returns created entries.
	 */
	bulkAddEntries(
		entries: Array<{
			path: string;
			changefreq?: ChangeFreq;
			priority?: number;
			lastmod?: Date;
		}>,
	): Promise<SitemapEntry[]>;

	/**
	 * Remove multiple entries by IDs. Returns number removed.
	 */
	bulkRemoveEntries(ids: string[]): Promise<number>;

	/**
	 * List all entries (auto-generated + custom).
	 */
	listEntries(params?: {
		source?: string;
		take?: number;
		skip?: number;
	}): Promise<SitemapEntry[]>;

	/**
	 * Count entries.
	 */
	countEntries(source?: string): Promise<number>;

	/**
	 * Generate the sitemap XML string from entries.
	 * When the entry count exceeds MAX_ENTRIES_PER_SITEMAP, returns only
	 * entries for the given page (0-indexed). Returns all entries otherwise.
	 */
	generateXml(page?: number): Promise<string>;

	/**
	 * Generate a sitemap index XML referencing sub-sitemaps.
	 * Returns null if all entries fit in a single sitemap.
	 */
	generateSitemapIndex(): Promise<string | null>;

	/**
	 * Rebuild entries from configured sources.
	 * Called by admin "regenerate" action.
	 * Accepts external page data to build entries from.
	 */
	regenerate(pages: {
		products?: Array<{ slug: string; updatedAt?: Date }>;
		collections?: Array<{ slug: string; updatedAt?: Date }>;
		pages?: Array<{ slug: string; updatedAt?: Date }>;
		blog?: Array<{ slug: string; updatedAt?: Date }>;
		brands?: Array<{ slug: string; updatedAt?: Date }>;
	}): Promise<number>;

	getStats(): Promise<SitemapStats>;
};
