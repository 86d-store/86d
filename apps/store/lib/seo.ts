import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import { cache } from "react";
import { getBaseUrl } from "utils/url";
import type {
	LlmsBlogPost,
	LlmsCollection,
	LlmsProduct,
} from "../../../packages/lib/src/llms-content";
import { getModuleDataService } from "./module-data-access";
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
const getProductsData = cache(async () => getModuleDataService("products"));

/**
 * Fetch a single product by slug for metadata generation.
 */
export const fetchProductForSeo = cache(
	async (slug: string): Promise<ProductSeo | null> => {
		const data = await getProductsData();
		if (!data) return null;

		const rows = await data.findMany("product", { where: { slug }, take: 1 });
		const d = rows[0] as JsonData | undefined;
		if (d?.status !== "active") return null;

		return {
			name: d.name as string,
			slug: d.slug as string,
			description: d.description as string,
			shortDescription: d.shortDescription as string,
			price: typeof d.price === "number" ? d.price : 0,
			compareAtPrice:
				typeof d.compareAtPrice === "number" ? d.compareAtPrice : null,
			images: normalizeImages(d.images),
			status: d.status as string,
			sku: d.sku as string,
			updatedAt:
				typeof d.updatedAt === "string"
					? d.updatedAt
					: new Date().toISOString(),
		};
	},
);

/**
 * Fetch a single collection by slug for metadata generation.
 * Catalog collections live on the products module (same source as storefront list/detail).
 */
export const fetchCollectionForSeo = cache(
	async (slug: string): Promise<CollectionSeo | null> => {
		const data = await getProductsData();
		if (!data) return null;

		const rows = await data.findMany("collection", {
			where: { slug },
			take: 1,
		});
		const d = rows[0] as JsonData | undefined;
		if (!d || d.isVisible === false) return null;

		return {
			name: d.name as string,
			slug: d.slug as string,
			description: d.description as string,
			image: d.image as string,
			updatedAt:
				typeof d.updatedAt === "string"
					? d.updatedAt
					: new Date().toISOString(),
		};
	},
);

/**
 * Resolve a module's DB ID for the current store by module name.
 * Cached per request via React `cache()`.
 */
const getNamedModuleData = cache(async (moduleName: string) =>
	getModuleDataService(moduleName),
);

/**
 * Fetch all active product slugs + updatedAt for the sitemap.
 */
export async function fetchProductSlugsForSitemap(): Promise<SitemapEntry[]> {
	const data = await getProductsData();
	if (!data) return [];

	const rows = await data.findMany("product", { where: { status: "active" } });

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				slug: d.slug as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

/**
 * Fetch all visible collection slugs + updatedAt for the sitemap.
 */
export async function fetchCollectionSlugsForSitemap(): Promise<
	SitemapEntry[]
> {
	const data = await getProductsData();
	if (!data) return [];

	const rows = await data.findMany("collection", {
		where: { isVisible: true },
	});

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				slug: d.slug as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

/**
 * Get the store name from config (async).
 */
export async function getStoreName(): Promise<string> {
	try {
		const config = await getStoreConfigCached();
		return config.name;
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
		const data = await getNamedModuleData("blog");
		if (!data) return null;

		const posts = await data.findMany("post", { where: { slug }, take: 1 });
		const d = posts[0] as JsonData | undefined;
		if (d?.status !== "published") return null;

		return {
			title: d.title as string,
			slug: d.slug as string,
			excerpt: d.excerpt as string,
			coverImage: d.coverImage as string,
			author: d.author as string,
			category: d.category as string,
			updatedAt:
				typeof d.updatedAt === "string"
					? d.updatedAt
					: new Date().toISOString(),
		};
	},
);

/**
 * Fetch all published blog post slugs + updatedAt for the sitemap.
 */
export async function fetchBlogPostSlugsForSitemap(): Promise<SitemapEntry[]> {
	const data = await getNamedModuleData("blog");
	if (!data) return [];

	const rows = await data.findMany("post", { where: { status: "published" } });

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				slug: d.slug as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

/**
 * Fetch active flash sale slugs for the sitemap.
 */
export async function fetchFlashSaleSlugsForSitemap(): Promise<SitemapEntry[]> {
	const data = await getNamedModuleData("flash-sales");
	if (!data) return [];

	const now = new Date().toISOString();
	const rows = await data.findMany("flashSale", {
		where: { status: "active" },
	});

	return rows
		.filter((r) => {
			const d = r as JsonData;
			if (typeof d.slug !== "string") return false;
			const endsAt = typeof d.endsAt === "string" ? d.endsAt : null;
			return !endsAt || endsAt > now;
		})
		.map((r) => {
			const d = r as JsonData;
			return {
				slug: d.slug as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

/**
 * Fetch active auction IDs for the sitemap.
 */
export async function fetchAuctionIdsForSitemap(): Promise<
	Array<{ id: string; updatedAt: Date }>
> {
	const data = await getNamedModuleData("auctions");
	if (!data) return [];

	const now = new Date().toISOString();
	const rows = await data.findMany("auction", { where: { status: "active" } });

	return rows
		.filter((r) => {
			const d = r as JsonData;
			const endsAt = typeof d.endsAt === "string" ? d.endsAt : null;
			return !endsAt || endsAt > now;
		})
		.map((r) => {
			const d = r as JsonData;
			return {
				id: d.id as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

/**
 * Fetch active preorder campaign IDs for the sitemap.
 */
export async function fetchPreorderCampaignIdsForSitemap(): Promise<
	Array<{ id: string; updatedAt: Date }>
> {
	const data = await getNamedModuleData("preorders");
	if (!data) return [];

	const now = new Date().toISOString();
	const rows = await data.findMany("campaign", {});

	return rows
		.filter((r) => {
			const d = r as JsonData;
			const endDate = typeof d.endDate === "string" ? d.endDate : null;
			return !endDate || endDate > now;
		})
		.map((r) => {
			const d = r as JsonData;
			return {
				id: d.id as string,
				updatedAt: new Date(
					typeof d.updatedAt === "string" ? d.updatedAt : Date.now(),
				),
			};
		});
}

// ── llms-full.txt content fetchers ──────────────────────────────────────────

/**
 * Fetch all active products for llms-full.txt.
 */
export async function fetchProductsForLlms(): Promise<LlmsProduct[]> {
	const data = await getProductsData();
	if (!data) return [];

	const rows = await data.findMany("product", {
		where: { status: "active" },
		orderBy: { createdAt: "desc" },
		take: 500,
	});

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				name: d.name as string,
				slug: d.slug as string,
				shortDescription: d.shortDescription as string,
				price: typeof d.price === "number" ? d.price : 0,
				images: normalizeImages(d.images).map((img) => img.url),
			};
		});
}

/**
 * Fetch all visible collections for llms-full.txt.
 */
export async function fetchCollectionsForLlms(): Promise<LlmsCollection[]> {
	const data = await getProductsData();
	if (!data) return [];

	const rows = await data.findMany("collection", {
		where: { isVisible: true },
		orderBy: { createdAt: "asc" },
		take: 200,
	});

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				name: d.name as string,
				slug: d.slug as string,
				description: d.description as string,
			};
		});
}

/**
 * Fetch all published blog posts for llms-full.txt.
 */
export async function fetchBlogPostsForLlms(): Promise<LlmsBlogPost[]> {
	const data = await getNamedModuleData("blog");
	if (!data) return [];

	const rows = await data.findMany("post", {
		where: { status: "published" },
		orderBy: { createdAt: "desc" },
		take: 200,
	});

	return rows
		.filter((r) => typeof (r as JsonData).slug === "string")
		.map((r) => {
			const d = r as JsonData;
			return {
				title: d.title as string,
				slug: d.slug as string,
				excerpt: d.excerpt as string,
				author: d.author as string,
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

export type {
	LlmsBlogPost,
	LlmsCollection,
	LlmsProduct,
} from "../../../packages/lib/src/llms-content";
