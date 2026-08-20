"use client";

import type { MDXComponents } from "mdx/types";
import type { CollectionCardData, Product } from "./_types";
import { CollectionCard } from "./collection-card";
import { CollectionDetail } from "./collection-detail";
import { CollectionGrid } from "./collection-grid";
import { FeaturedProducts } from "./featured-products";
import { FilterChip } from "./filter-chip";
import { ProductCard } from "./product-card";
import { ProductDetail } from "./product-detail";
import { ProductListing } from "./product-listing";
import { ProductReviewsSection } from "./product-reviews-section";
import { RecentlyViewedProducts } from "./recently-viewed";
import { RecommendedProducts } from "./recommended-products";
import { RelatedProducts } from "./related-products";
import { StarDisplay } from "./star-display";
import { StarPicker } from "./star-picker";
import { StockBadge } from "./stock-badge";

export default {
	ProductCard: ({ product }: { product: Product }) => (
		<ProductCard product={product} />
	),
	FeaturedProducts,
	ProductListing,
	ProductDetail,
	RelatedProducts,
	CollectionCard: ({ collection }: { collection: CollectionCardData }) => (
		<CollectionCard collection={collection} />
	),
	CollectionGrid,
	CollectionDetail,
	FilterChip,
	StarDisplay,
	StarPicker,
	StockBadge,
	ProductReviewsSection,
	RecentlyViewedProducts,
	RecommendedProducts,
} satisfies MDXComponents;
