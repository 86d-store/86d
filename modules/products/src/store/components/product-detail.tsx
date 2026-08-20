"use client";

import { useStoreContext } from "@86d-app/core/client/store-context";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
	normalizeCartQueryData,
	useCartMutation,
	useProductLabels,
	useProductsApi,
	useReviewsApi,
	useTrack,
} from "./_hooks";
import type {
	ProductVariant,
	ProductWithVariants,
	ReviewsResponse,
} from "./_types";
import { formatPrice, imageUrl } from "./_utils";
import { BackInStockNotify } from "./back-in-stock-notify";
import { BackorderSection } from "./backorder-section";
import { BrandSection } from "./brand-section";
import { BulkPricingSection } from "./bulk-pricing-section";
import { ComparisonButtonSection } from "./comparison-button-section";
import { FlashDealSection } from "./flash-deal-section";
import { LoyaltyPointsSection } from "./loyalty-points-section";
import { PreorderSection } from "./preorder-section";
import ProductDetailTemplate from "./product-detail.mdx";
import { ProductQASection } from "./product-qa-section";
import { ProductReviewsSection } from "./product-reviews-section";
import { RecentlyViewedProducts } from "./recently-viewed";
import { RecommendedProducts } from "./recommended-products";
import { RelatedProducts } from "./related-products";
import {
	ProductActivitySection,
	TrustBadgesSection,
} from "./social-proof-section";
import { SocialSharingSection } from "./social-sharing-section";
import { StarDisplay } from "./star-display";
import { StockBadge } from "./stock-badge";
import { WishlistButtonSection } from "./wishlist-button-section";

export type ProductDetailProps = {
	slug?: string;
	params?: Record<string, string>;
};

export function ProductDetail(props: ProductDetailProps) {
	const slug = props.slug ?? props.params?.slug;
	const api = useProductsApi();
	const cartApi = useCartMutation();
	const reviewsApi = useReviewsApi();
	const track = useTrack();
	const store = useStoreContext<{
		cart: {
			setItemCount(count: number): void;
			openDrawer(): void;
			setOptimisticCart(
				cart: ReturnType<typeof normalizeCartQueryData> | null,
			): void;
		};
	}>();

	const { data, isLoading, isError } = api.getProduct.useQuery(
		{ params: { id: slug ?? "" } },
		{
			enabled: !!slug,
			/* SSR prefetch reads moduleData directly; the live catalog API is authoritative for cart. */
			staleTime: 0,
			refetchOnMount: "always",
		},
	) as {
		data: { product: ProductWithVariants } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const product = data?.product ?? null;
	const labels = useProductLabels(product?.id);

	const { data: reviewsSummaryData } = reviewsApi.listProductReviews.useQuery(
		product
			? {
					params: { productId: product.id },
					take: "1",
				}
			: undefined,
	) as { data: ReviewsResponse | undefined };
	const reviewSummary = reviewsSummaryData?.summary;

	const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
		null,
	);
	const [selectedImage, setSelectedImage] = useState(0);
	const [qty, setQty] = useState(1);
	const [added, setAdded] = useState(false);

	type AddToCartResponse = {
		cart: { id: string };
		items: {
			id: string;
			productId: string;
			variantId?: string | null;
			quantity: number;
			price: number;
			productName: string;
			productSlug: string;
			productImage?: string | null;
			variantName?: string | null;
			variantOptions?: Record<string, string> | null;
		}[];
		itemCount: number;
		subtotal: number;
	};

	const trackedRef = useRef<string | null>(null);
	useEffect(() => {
		if (product && trackedRef.current !== product.id) {
			trackedRef.current = product.id;
			track({
				type: "productView",
				productId: product.id,
				data: {
					name: product.name,
					slug: product.slug,
					price: product.price,
					image: imageUrl(product.images[0]),
				},
			});
		}
	}, [product, track]);

	const firstVariant = product?.variants?.[0] ?? null;
	useEffect(() => {
		if (product && firstVariant) {
			setSelectedVariant(firstVariant);
		}
	}, [product, firstVariant]);

	const addToCartMutation = cartApi.addToCart.useMutation({
		onSuccess: (data: AddToCartResponse) => {
			const normalized = normalizeCartQueryData(data);
			store.cart.setOptimisticCart(normalized);
			store.cart.setItemCount(data.itemCount);
			store.cart.openDrawer();
			cartApi.queryClient.setQueryData(
				cartApi.getCart.getQueryKey(),
				normalized,
			);
			setAdded(true);
			setTimeout(() => setAdded(false), 2000);
			if (product) {
				track({
					type: "addToCart",
					productId: product.id,
					value: selectedVariant?.price ?? product.price,
					data: {
						name: product.name,
						quantity: qty,
						variantId: selectedVariant?.id,
					},
				});
			}
		},
	});

	if (!slug) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Product not found</p>
				<p className="mt-1 text-sm">No product was specified.</p>
				<Link href="/products" className="mt-3 inline-block text-sm underline">
					Back to products
				</Link>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="py-6">
				<div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
					<div className="aspect-square animate-pulse rounded-lg bg-muted" />
					<div className="space-y-4 py-2">
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
						<div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
						<div className="h-6 w-24 animate-pulse rounded bg-muted" />
						<div className="h-20 animate-pulse rounded bg-muted" />
					</div>
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<p className="font-medium text-foreground text-sm">
					Something went wrong
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					We couldn&apos;t load this product. Please try again.
				</p>
				<Link
					href="/products"
					className="mt-3 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					Back to products
				</Link>
			</div>
		);
	}

	if (!product) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<p className="font-medium text-foreground text-sm">Product not found</p>
				<Link
					href="/products"
					className="mt-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					Back to products
				</Link>
			</div>
		);
	}

	const optionKeys: string[] = [];
	const optionValues: Record<string, string[]> = {};
	for (const v of product.variants) {
		for (const [key, value] of Object.entries(v.options)) {
			if (!optionValues[key]) {
				optionKeys.push(key);
				optionValues[key] = [];
			}
			if (!optionValues[key].includes(value)) {
				optionValues[key].push(value);
			}
		}
	}

	const selectedOptions: Record<string, string> = {};
	if (selectedVariant) {
		for (const [key, value] of Object.entries(selectedVariant.options)) {
			selectedOptions[key] = value;
		}
	}

	const handleOptionChange = (key: string, value: string) => {
		const newOptions = { ...selectedOptions, [key]: value };
		const match = product.variants.find((v) =>
			Object.entries(newOptions).every(([k, val]) => v.options[k] === val),
		);
		if (match) {
			setSelectedVariant(match);
		}
	};

	const displayPrice = selectedVariant?.price ?? product.price;
	const comparePrice =
		selectedVariant?.compareAtPrice ?? product.compareAtPrice;
	const hasDiscount = comparePrice != null && comparePrice > displayPrice;
	const inStock = (selectedVariant?.inventory ?? product.inventory) > 0;

	const handleAddToCart = () => {
		addToCartMutation.mutate({
			productId: product.id,
			variantId: selectedVariant?.id ?? undefined,
			quantity: qty,
			price: displayPrice,
			productName: product.name,
			productSlug: product.slug,
			productImage: imageUrl(product.images[0]),
			variantName: selectedVariant?.name,
			variantOptions: selectedVariant?.options,
		});
	};

	// --- Pre-computed JSX blocks for template ---

	const breadcrumbs = (
		<nav className="mb-6 flex items-center gap-1.5 text-muted-foreground text-xs">
			<Link href="/" className="transition-colors hover:text-foreground">
				Home
			</Link>
			<span className="text-border">/</span>
			<Link
				href="/products"
				className="transition-colors hover:text-foreground"
			>
				Products
			</Link>
			<span className="text-border">/</span>
			<span className="truncate text-foreground">{product.name}</span>
		</nav>
	);

	const imageGallery = (
		<div className="space-y-2.5">
			<div className="aspect-square overflow-hidden rounded-lg bg-muted">
				{product.images[selectedImage] ? (
					<Image
						src={imageUrl(product.images[selectedImage])}
						alt={product.name}
						width={800}
						height={800}
						unoptimized
						className="h-full w-full object-cover object-center"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
					</div>
				)}
			</div>
			{product.images.length > 1 && (
				<div className="flex gap-1.5">
					{product.images.map((img, i) => (
						<button
							key={img}
							type="button"
							onClick={() => setSelectedImage(i)}
							className={`h-14 w-14 overflow-hidden rounded-md transition-all ${
								i === selectedImage
									? "ring-1.5 ring-foreground ring-offset-1 ring-offset-background"
									: "opacity-50 hover:opacity-80"
							}`}
						>
							<Image
								src={imageUrl(img)}
								alt={`${product.name} view ${i + 1}`}
								width={56}
								height={56}
								unoptimized
								className="h-full w-full object-cover"
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);

	const brandInfo = <BrandSection productId={product.id} />;

	const categoryLink = product.category ? (
		<Link
			href={`/products?category=${product.category.id}`}
			className="w-fit text-muted-foreground text-xs transition-colors hover:text-foreground"
		>
			{product.category.name}
		</Link>
	) : null;

	const labelsBlock =
		labels.length > 0 ? (
			<div className="flex flex-wrap gap-1.5">
				{labels.map((label) => (
					<span
						key={label.id}
						className="rounded-full px-2.5 py-0.5 font-medium text-xs"
						style={{
							backgroundColor: label.backgroundColor ?? "var(--foreground)",
							color: label.color ?? "var(--background)",
						}}
					>
						{label.displayText}
					</span>
				))}
			</div>
		) : null;

	const reviewSummaryLink =
		reviewSummary && reviewSummary.count > 0 ? (
			<a
				href="#reviews"
				className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
			>
				<StarDisplay rating={reviewSummary.average} size="sm" />
				<span className="text-muted-foreground text-sm">
					{reviewSummary.average.toFixed(1)} ({reviewSummary.count})
				</span>
			</a>
		) : null;

	const priceBlock = (
		<div className="flex items-center gap-2.5">
			<span className="font-display text-foreground text-xl tabular-nums sm:text-2xl">
				{formatPrice(displayPrice)}
			</span>
			{hasDiscount && (
				<>
					<span className="text-muted-foreground text-sm tabular-nums line-through">
						{formatPrice(comparePrice as number)}
					</span>
					<span className="rounded-full bg-foreground px-2 py-0.5 font-medium text-2xs text-background tabular-nums">
						−{Math.round((1 - displayPrice / (comparePrice as number)) * 100)}%
					</span>
				</>
			)}
		</div>
	);

	const stockBadge = (
		<StockBadge inventory={selectedVariant?.inventory ?? product.inventory} />
	);

	const shortDescription = product.shortDescription ? (
		<p className="text-muted-foreground text-sm leading-relaxed">
			{product.shortDescription}
		</p>
	) : null;

	let variantSelector: React.ReactNode = null;
	if (product.variants.length > 0 && optionKeys.length > 0) {
		variantSelector = (
			<div className="space-y-3.5">
				{optionKeys.map((key) => (
					<div key={key} className="space-y-1.5">
						<p className="text-foreground text-xs">
							{key}
							{selectedOptions[key] && (
								<span className="ml-1.5 text-muted-foreground">
									{selectedOptions[key]}
								</span>
							)}
						</p>
						<div className="flex flex-wrap gap-1.5">
							{(optionValues[key] ?? []).map((value) => {
								const isSelected = selectedOptions[key] === value;
								const wouldMatch = product.variants.some(
									(v) =>
										v.options[key] === value &&
										Object.entries(selectedOptions).every(
											([k, val]) => k === key || v.options[k] === val,
										),
								);
								return (
									<button
										key={value}
										type="button"
										onClick={() => handleOptionChange(key, value)}
										disabled={!wouldMatch}
										className={`rounded-md border px-3 py-1.5 text-sm transition-all ${
											isSelected
												? "border-foreground bg-foreground text-background"
												: wouldMatch
													? "border-border text-foreground hover:border-foreground/40"
													: "border-border/40 text-muted-foreground/30 line-through"
										}`}
									>
										{value}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>
		);
	} else if (product.variants.length > 0 && optionKeys.length === 0) {
		variantSelector = (
			<div className="space-y-1.5">
				<p className="text-foreground text-xs">
					{selectedVariant ? selectedVariant.name : "Select option"}
				</p>
				<div className="flex flex-wrap gap-1.5">
					{product.variants.map((v) => (
						<button
							key={v.id}
							type="button"
							onClick={() => setSelectedVariant(v)}
							className={`rounded-md border px-3 py-1.5 text-sm transition-all ${
								selectedVariant?.id === v.id
									? "border-foreground bg-foreground text-background"
									: "border-border text-foreground hover:border-foreground/40"
							}`}
						>
							{v.name}
						</button>
					))}
				</div>
			</div>
		);
	}

	const wishlistButton = (
		<WishlistButtonSection
			productId={product.id}
			productName={product.name}
			productImage={imageUrl(product.images[0])}
		/>
	);

	const loyaltyPoints = <LoyaltyPointsSection priceInCents={displayPrice} />;

	const compareButton = (
		<ComparisonButtonSection
			productId={product.id}
			productName={product.name}
			productSlug={product.slug}
			productImage={imageUrl(product.images[0])}
			productPrice={displayPrice}
		/>
	);

	const addToCartBlock = (
		<div className="mt-1 flex items-center gap-2.5">
			<div className="flex items-center rounded-md border border-border">
				<button
					type="button"
					onClick={() => setQty((q) => Math.max(1, q - 1))}
					className="flex h-10 w-10 items-center justify-center text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					−
				</button>
				<span className="min-w-8 text-center text-foreground text-sm tabular-nums">
					{qty}
				</span>
				<button
					type="button"
					onClick={() => setQty((q) => q + 1)}
					className="flex h-10 w-10 items-center justify-center text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					+
				</button>
			</div>
			<button
				type="button"
				onClick={handleAddToCart}
				disabled={addToCartMutation.isPending || !inStock}
				className="flex-1 rounded-md bg-foreground py-2.5 font-medium text-background text-sm transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-40"
			>
				{!inStock
					? "Sold out"
					: added
						? "Added!"
						: addToCartMutation.isPending
							? "Adding…"
							: "Add to cart"}
			</button>
		</div>
	);

	const outOfStockNotice = !inStock ? (
		<div className="flex flex-col gap-2">
			<PreorderSection productId={product.id} variantId={selectedVariant?.id} />
			<BackorderSection
				productId={product.id}
				productName={product.name}
				variantId={selectedVariant?.id}
				variantLabel={selectedVariant?.name}
			/>
			<BackInStockNotify
				productId={product.id}
				variantId={selectedVariant?.id}
				productName={product.name}
			/>
		</div>
	) : null;

	const descriptionBlock = product.description ? (
		<div className="mt-2 border-border/50 border-t pt-5">
			<p className="mb-2 font-medium text-foreground text-xs">Description</p>
			<p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
				{product.description}
			</p>
		</div>
	) : null;

	const tagsBlock =
		product.tags.length > 0 ? (
			<div className="flex flex-wrap gap-1">
				{product.tags.map((t) => (
					<Link
						key={t}
						href={`/products?tag=${encodeURIComponent(t)}`}
						className="rounded-md bg-muted px-2 py-0.5 text-foreground text-xs transition-colors hover:bg-muted-foreground/20"
					>
						{t}
					</Link>
				))}
			</div>
		) : null;

	const productUrl = `${window.location.origin}/products/${product.slug}`;
	const socialSharing = (
		<SocialSharingSection
			productId={product.id}
			productName={product.name}
			productUrl={productUrl}
		/>
	);

	return (
		<ProductDetailTemplate
			breadcrumbs={breadcrumbs}
			imageGallery={imageGallery}
			brandInfo={brandInfo}
			categoryLink={categoryLink}
			labelsBlock={labelsBlock}
			name={product.name}
			reviewSummaryLink={reviewSummaryLink}
			priceBlock={priceBlock}
			stockBadge={stockBadge}
			shortDescription={shortDescription}
			variantSelector={variantSelector}
			addToCartBlock={addToCartBlock}
			wishlistButton={wishlistButton}
			compareButton={compareButton}
			loyaltyPoints={loyaltyPoints}
			pricingTiers={
				<BulkPricingSection
					productId={product.id}
					basePriceInCents={selectedVariant?.price ?? product.price}
					quantity={qty}
				/>
			}
			flashDeal={<FlashDealSection productId={product.id} />}
			activityBadge={<ProductActivitySection productId={product.id} />}
			trustBadges={<TrustBadgesSection position="product" />}
			outOfStockNotice={outOfStockNotice}
			descriptionBlock={descriptionBlock}
			tagsBlock={tagsBlock}
			socialSharing={socialSharing}
			reviewsSection={<ProductReviewsSection productId={product.id} />}
			questionsSection={<ProductQASection productId={product.id} />}
			recommendedProducts={<RecommendedProducts productId={product.id} />}
			relatedProducts={<RelatedProducts productId={product.id} />}
			recentlyViewed={<RecentlyViewedProducts excludeProductId={product.id} />}
		/>
	);
}
