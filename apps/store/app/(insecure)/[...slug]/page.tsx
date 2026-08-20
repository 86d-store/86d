import { getQueryClient } from "@86d-app/core/client/query-client";
import { dehydrate, HydrationBoundary } from "@86d-app/core/client/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBaseUrl } from "utils/url";
import {
	buildCollectionJsonLd,
	buildProductJsonLd,
	fetchCollectionForSeo,
	fetchProductForSeo,
	getStoreName,
} from "~/lib/seo";
import { prefetchProductBySlug } from "~/lib/server-prefetch";
import { getStoreRoute } from "~/lib/store-registry";
import { StoreModuleRouteClient } from "./store-module-route-client";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const path = `/${slug.join("/")}`;
	const match = getStoreRoute(path);
	if (!match) return {};

	const { params: routeParams } = match;
	const slugParam = routeParams?.slug;

	// Product detail: /products/:slug
	if (path.startsWith("/products/") && slugParam) {
		const product = await fetchProductForSeo(slugParam);
		if (!product) return { title: "Product not found" };
		const storeName = await getStoreName();
		const url = getBaseUrl();
		const title = `${product.name} — ${storeName}`;
		const description =
			product.shortDescription ??
			product.description?.slice(0, 160) ??
			`Shop ${product.name} at ${storeName}`;
		return {
			title,
			description,
			openGraph: {
				title,
				description,
				url: `${url}/products/${product.slug}`,
				type: "website",
				...(product.images.length > 0 && {
					images: product.images.map((img) => ({
						url: img.url,
						alt: img.alt ?? product.name,
					})),
				}),
			},
			alternates: {
				canonical: `${url}/products/${product.slug}`,
			},
		};
	}

	// Collection detail: /collections/:slug
	if (path.startsWith("/collections/") && slugParam) {
		const collection = await fetchCollectionForSeo(slugParam);
		if (!collection) return { title: "Collection not found" };
		const storeName = await getStoreName();
		const url = getBaseUrl();
		const title = `${collection.name} — ${storeName}`;
		const description =
			collection.description?.slice(0, 160) ??
			`Shop the ${collection.name} collection at ${storeName}`;
		return {
			title,
			description,
			openGraph: {
				title,
				description,
				url: `${url}/collections/${collection.slug}`,
				type: "website",
				...(collection.image && {
					images: [{ url: collection.image, alt: collection.name }],
				}),
			},
			alternates: {
				canonical: `${url}/collections/${collection.slug}`,
			},
		};
	}

	return {};
}

export default async function StoreCatchAllPage({ params }: Props) {
	const { slug } = await params;
	const path = `/${slug.join("/")}`;
	const match = getStoreRoute(path);

	if (!match) {
		notFound();
	}

	const { moduleId, component, params: routeParams } = match;
	const slugParam = routeParams?.slug;

	// Fetch SEO data for product/collection detail pages (for JSON-LD)
	let jsonLd: object | null = null;
	if (path.startsWith("/products/") && slugParam) {
		const product = await fetchProductForSeo(slugParam);
		if (product) jsonLd = buildProductJsonLd(product);
	} else if (path.startsWith("/collections/") && slugParam) {
		const collection = await fetchCollectionForSeo(slugParam);
		if (collection) jsonLd = buildCollectionJsonLd(collection);
	}

	// Prefetch product data for React Query hydration (eliminates flash-of-empty)
	const queryClient = getQueryClient();
	if (path.startsWith("/products/") && slugParam) {
		const productData = await prefetchProductBySlug(slugParam);
		if (productData) {
			queryClient.setQueryData(
				["products", "store", "/products/:id", { params: { id: slugParam } }],
				{ product: productData.product },
			);
		}
	}

	const content = (
		<>
			{jsonLd && (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			)}
			<StoreModuleRouteClient
				moduleId={moduleId}
				component={component}
				params={routeParams}
			/>
		</>
	);

	// Only wrap with HydrationBoundary when we have prefetched data
	if (path.startsWith("/products/") && slugParam) {
		return (
			<HydrationBoundary state={dehydrate(queryClient)}>
				{content}
			</HydrationBoundary>
		);
	}

	return content;
}
