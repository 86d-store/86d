import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import { db } from "db";
import env from "env";
import { cache } from "react";
import { getBaseUrl } from "utils/url";
import type {
	LlmsBlogPost,
	LlmsCollection,
	LlmsProduct,
} from "../../../packages/lib/src/llms-content";
import { resolveTemplatePath } from "./template-path";

const getStoreConfigCached = cache(async () =>
	getStoreConfig({
		templatePath: resolveTemplatePath(),
	}),
);

type JsonData = Record<string, unknown>;

interface ImageObject {
	url: string;
	alt?: string;
}

interface ProductSeo {
	name: string;
	slug: string;
	description: string | null;
	shortDescription: string | null;
	price: number;
	compareAtPrice: number | null;
	images: ImageObject[];
	status: string;
	sku: string | null;
	updatedAt: string;
}

/** Normalize image entries: could be strings or {url, alt} objects. */
function normalizeImages(raw: unknown): ImageObject[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((item) => {
			if (typeof item === "string") return { url: item };
			if (
				typeof item === "object" &&
				item !== null &&
				"url" in item &&
				typeof (item as Record<string, unknown>).url === "string"
			) {
				const obj = item as Record<string, unknown>;
				return {
					url: obj.url as string,
					alt: typeof obj.alt === "string" ? obj.alt : undefined,
				};
			}
			return null;
		})
		.filter((img): img is ImageObject => img !== null);
}

interface CollectionSeo {
	name: string;
	slug: string;
	description: string | null;
	image: string | null;
	updatedAt: string;
}

interface SitemapEntry {
	slug: string;
	updatedAt: Date;
}

/**
 * Resolve the products module DB ID for the current store.
 * Cached per request via React `cache()`.
 */
const getProductsModuleId = cache(async (): Promise<string | null> => {
	const storeId = env.STORE_ID;
	if (!storeId) return null;

	try {
		const mod = await db.module.findFirst({
			where: {
				storeId,
				name: "products",
			},
			select: { id: true },
		});
		return mod?.id ?? null;
	} catch {
		// DB unavailable (e.g. build time without DATABASE_URL)
		return null;
	}
});

/**
 * Fetch a single product by slug for metadata generation.
 */
export const fetchProductForSeo = cache(
	async (slug: string): Promise<ProductSeo | null> => {
		const moduleId = await getProductsModuleId();
		if (!moduleId) return null;

		const row = await db.moduleData.findFirst({
			where: {
				moduleId,
				entityType: "product",
				data: {
					path: ["slug"],
					equals: slug,
				},
			},
			select: { data: true, updatedAt: true },
		});

		if (!row?.data) return null;

		const d = row.data as JsonData;
		if (d.status !== "active") return null;

		return {
			name: (d.name as string) ?? "",
			slug: (d.slug as string) ?? slug,
			description: (d.description as string) ?? null,
			shortDescription: (d.shortDescription as string) ?? null,
			price: typeof d.price === "number" ? d.price : 0,
			compareAtPrice:
				typeof d.compareAtPrice === "number" ? d.compareAtPrice : null,
			images: normalizeImages(d.images),
			status: (d.status as string) ?? "draft",
			sku: (d.sku as string) ?? null,
			updatedAt: row.updatedAt.toISOString(),
		};
	},
);

/**
 * Fetch a single collection by slug for metadata generation.
 * Catalog collections live on the products module (same source as storefront list/detail).
 */
export const fetchCollectionForSeo = cache(
	async (slug: string): Promise<CollectionSeo | null> => {
		const moduleId = await getProductsModuleId();
		if (!moduleId) return null;

		const row = await db.moduleData.findFirst({
			where: {
				moduleId,
				entityType: "collection",
				data: {
					path: ["slug"],
					equals: slug,
				},
			},
			select: { data: true, updatedAt: true },
		});

		if (!row?.data) return null;

		const d = row.data as JsonData;
		if (d.isVisible === false) return null;

		return {
			name: (d.name as string) ?? "",
			slug: (d.slug as string) ?? slug,
			description: (d.description as string) ?? null,
			image: (d.image as string) ?? null,
			updatedAt: row.updatedAt.toISOString(),
		};
	},
);

/**
 * Resolve a module's DB ID for the current store by module name.
 * Cached per request via React `cache()`.
 */
const getModuleIdByName = cache(
	async (moduleName: string): Promise<string | null> => {
		const storeId = env.STORE_ID;
		if (!storeId) return null;

		try {
			const mod = await db.module.findFirst({
				where: {
					storeId,
					name: moduleName,
				},
				select: { id: true },
			});
			return mod?.id ?? null;
		} catch {
			// DB unavailable (e.g. build time without DATABASE_URL)
			return null;
		}
	},
);

/**
 * Fetch all active product slugs + updatedAt for the sitemap.
 */
export async function fetchProductSlugsForSitemap(): Promise<SitemapEntry[]> {
	const moduleId = await getProductsModuleId();
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "product",
			data: {
				path: ["status"],
				equals: "active",
			},
		},
		select: { data: true, updatedAt: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => ({
			slug: (r.data as JsonData).slug as string,
			updatedAt: r.updatedAt,
		}));
}

/**
 * Fetch all visible collection slugs + updatedAt for the sitemap.
 */
export async function fetchCollectionSlugsForSitemap(): Promise<
	SitemapEntry[]
> {
	const moduleId = await getProductsModuleId();
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "collection",
			data: {
				path: ["isVisible"],
				equals: true,
			},
		},
		select: { data: true, updatedAt: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => ({
			slug: (r.data as JsonData).slug as string,
			updatedAt: r.updatedAt,
		}));
}

/**
 * Get the store name from config (async).
 */
export async function getStoreName(): Promise<string> {
	try {
		const config = await getStoreConfigCached();
		return config.name ?? "86d Store";
	} catch {
		return "86d Store";
	}
}

/**
 * Build JSON-LD Product structured data.
 */
export function buildProductJsonLd(product: ProductSeo): object {
	const url = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name: product.name,
		url: `${url}/products/${product.slug}`,
		...(product.description && { description: product.description }),
		...(product.images.length > 0 && {
			image: product.images.map((img) => img.url),
		}),
		...(product.sku && { sku: product.sku }),
		offers: {
			"@type": "Offer",
			url: `${url}/products/${product.slug}`,
			priceCurrency: "USD",
			price: product.price.toFixed(2),
			availability: "https://schema.org/InStock",
		},
	};
}

/**
 * Build JSON-LD CollectionPage structured data.
 */
export function buildCollectionJsonLd(collection: CollectionSeo): object {
	const url = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: collection.name,
		url: `${url}/collections/${collection.slug}`,
		...(collection.description && { description: collection.description }),
		...(collection.image && { image: collection.image }),
	};
}

interface BlogPostSeo {
	title: string;
	slug: string;
	excerpt: string | null;
	coverImage: string | null;
	author: string | null;
	category: string | null;
	updatedAt: string;
}

/**
 * Fetch a single blog post by slug for metadata generation.
 */
export const fetchBlogPostForSeo = cache(
	async (slug: string): Promise<BlogPostSeo | null> => {
		const moduleId = await getModuleIdByName("blog");
		if (!moduleId) return null;

		const row = await db.moduleData.findFirst({
			where: {
				moduleId,
				entityType: "post",
				data: {
					path: ["slug"],
					equals: slug,
				},
			},
			select: { data: true, updatedAt: true },
		});

		if (!row?.data) return null;

		const d = row.data as JsonData;
		if (d.status !== "published") return null;

		return {
			title: (d.title as string) ?? "",
			slug: (d.slug as string) ?? slug,
			excerpt: (d.excerpt as string) ?? null,
			coverImage: (d.coverImage as string) ?? null,
			author: (d.author as string) ?? null,
			category: (d.category as string) ?? null,
			updatedAt: row.updatedAt.toISOString(),
		};
	},
);

/**
 * Fetch all published blog post slugs + updatedAt for the sitemap.
 */
export async function fetchBlogPostSlugsForSitemap(): Promise<SitemapEntry[]> {
	const moduleId = await getModuleIdByName("blog");
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "post",
			data: {
				path: ["status"],
				equals: "published",
			},
		},
		select: { data: true, updatedAt: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => ({
			slug: (r.data as JsonData).slug as string,
			updatedAt: r.updatedAt,
		}));
}

/**
 * Fetch active flash sale slugs for the sitemap.
 */
export async function fetchFlashSaleSlugsForSitemap(): Promise<SitemapEntry[]> {
	const moduleId = await getModuleIdByName("flash-sales");
	if (!moduleId) return [];

	const now = new Date().toISOString();
	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "flashSale",
			data: {
				path: ["status"],
				equals: "active",
			},
		},
		select: { data: true, updatedAt: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			if (!d || typeof d.slug !== "string") return false;
			const endsAt = typeof d.endsAt === "string" ? d.endsAt : null;
			return !endsAt || endsAt > now;
		})
		.map((r) => ({
			slug: (r.data as JsonData).slug as string,
			updatedAt: r.updatedAt,
		}));
}

/**
 * Fetch active auction IDs for the sitemap.
 */
export async function fetchAuctionIdsForSitemap(): Promise<
	Array<{ id: string; updatedAt: Date }>
> {
	const moduleId = await getModuleIdByName("auctions");
	if (!moduleId) return [];

	const now = new Date().toISOString();
	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "auction",
			data: {
				path: ["status"],
				equals: "active",
			},
		},
		select: { entityId: true, updatedAt: true, data: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			const endsAt = d && typeof d.endsAt === "string" ? d.endsAt : null;
			return !endsAt || endsAt > now;
		})
		.map((r) => ({ id: r.entityId, updatedAt: r.updatedAt }));
}

/**
 * Fetch active preorder campaign IDs for the sitemap.
 */
export async function fetchPreorderCampaignIdsForSitemap(): Promise<
	Array<{ id: string; updatedAt: Date }>
> {
	const moduleId = await getModuleIdByName("preorders");
	if (!moduleId) return [];

	const now = new Date().toISOString();
	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "campaign",
		},
		select: { entityId: true, updatedAt: true, data: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			if (!d) return false;
			const endDate = typeof d.endDate === "string" ? d.endDate : null;
			return !endDate || endDate > now;
		})
		.map((r) => ({ id: r.entityId, updatedAt: r.updatedAt }));
}

// ── llms-full.txt content fetchers ──────────────────────────────────────────

export type { LlmsBlogPost, LlmsCollection, LlmsProduct };

/**
 * Fetch all active products for llms-full.txt.
 */
export async function fetchProductsForLlms(): Promise<LlmsProduct[]> {
	const moduleId = await getProductsModuleId();
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "product",
			data: { path: ["status"], equals: "active" },
		},
		orderBy: { createdAt: "desc" },
		take: 500,
		select: { data: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => {
			const d = r.data as JsonData;
			return {
				name: (d.name as string) ?? "",
				slug: d.slug as string,
				shortDescription: (d.shortDescription as string) ?? null,
				price: typeof d.price === "number" ? d.price : 0,
				images: normalizeImages(d.images).map((img) => img.url),
			};
		});
}

/**
 * Fetch all visible collections for llms-full.txt.
 */
export async function fetchCollectionsForLlms(): Promise<LlmsCollection[]> {
	const moduleId = await getProductsModuleId();
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "collection",
			data: { path: ["isVisible"], equals: true },
		},
		orderBy: { createdAt: "asc" },
		take: 200,
		select: { data: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => {
			const d = r.data as JsonData;
			return {
				name: (d.name as string) ?? "",
				slug: d.slug as string,
				description: (d.description as string) ?? null,
			};
		});
}

/**
 * Fetch all published blog posts for llms-full.txt.
 */
export async function fetchBlogPostsForLlms(): Promise<LlmsBlogPost[]> {
	const moduleId = await getModuleIdByName("blog");
	if (!moduleId) return [];

	const rows = await db.moduleData.findMany({
		where: {
			moduleId,
			entityType: "post",
			data: { path: ["status"], equals: "published" },
		},
		orderBy: { createdAt: "desc" },
		take: 200,
		select: { data: true },
	});

	return rows
		.filter((r) => {
			const d = r.data as JsonData | null;
			return d && typeof d.slug === "string";
		})
		.map((r) => {
			const d = r.data as JsonData;
			return {
				title: (d.title as string) ?? "",
				slug: d.slug as string,
				excerpt: (d.excerpt as string) ?? null,
				author: (d.author as string) ?? null,
				publishedAt:
					typeof d.publishedAt === "string"
						? new Date(d.publishedAt).toISOString()
						: null,
			};
		});
}

/**
 * Build JSON-LD WebSite structured data for the root layout.
 */
export async function buildWebSiteJsonLd(): Promise<object> {
	const url = getBaseUrl();
	const storeName = await getStoreName();

	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: storeName,
		url,
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${url}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}
