"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useRef } from "react";

type RawCartItem = {
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
};

type AddToCartResponse = {
	cart: { id: string };
	items: RawCartItem[];
	itemCount: number;
	subtotal: number;
};

export function normalizeCartQueryData(data: AddToCartResponse) {
	return {
		id: data.cart.id,
		items: data.items.map((item) => ({
			id: item.id,
			productId: item.productId,
			variantId: item.variantId ?? null,
			quantity: item.quantity,
			price: item.price,
			product: {
				name: item.productName,
				price: item.price,
				images: item.productImage ? [item.productImage] : [],
				slug: item.productSlug,
			},
			variant: item.variantName
				? {
						name: item.variantName,
						options: item.variantOptions ?? {},
					}
				: null,
		})),
		itemCount: data.itemCount,
		subtotal: data.subtotal,
	};
}

export function useProductsApi() {
	const client = useModuleClient();
	return {
		listProducts: client.module("products").store["/products"],
		getFeaturedProducts: client.module("products").store["/products/featured"],
		getProduct: client.module("products").store["/products/:id"],
		getRelatedProducts:
			client.module("products").store["/products/:id/related"],
		listCategories: client.module("products").store["/categories"],
	};
}

export function useCartMutation() {
	const client = useModuleClient();
	return {
		addToCart: client.module("cart").store["/cart"],
		getCart: client.module("cart").store["/cart/get"],
		queryClient: client.queryClient,
	};
}

export function useReviewsApi() {
	const client = useModuleClient();
	return {
		listProductReviews:
			client.module("reviews").store["/reviews/products/:productId"],
		submitReview: client.module("reviews").store["/reviews"],
	};
}

export function useInventoryApi() {
	const client = useModuleClient();
	return {
		checkStock: client.module("inventory").store["/inventory/check"],
		subscribeBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/subscribe"],
		checkBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/check"],
		unsubscribeBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/unsubscribe"],
	};
}

export function useBulkPricingApi() {
	const client = useModuleClient();
	return {
		getProductTiers:
			client.module("bulk-pricing").store[
				"/bulk-pricing/product/:productId/tiers"
			],
	};
}

export function useFlashSalesApi() {
	const client = useModuleClient();
	return {
		getProductDeal:
			client.module("flash-sales").store["/flash-sales/product/:productId"],
	};
}

export function useSocialProofApi() {
	const client = useModuleClient();
	return {
		getProductActivity:
			client.module("social-proof").store["/social-proof/activity/:productId"],
		listBadges: client.module("social-proof").store["/social-proof/badges"],
	};
}

export function useProductLabels(productId: string | undefined) {
	const client = useModuleClient();
	const getProductLabels =
		client.module("product-labels").store[
			"/product-labels/products/:productId"
		];

	const { data } = getProductLabels.useQuery(
		{ productId: productId ?? "" },
		{ enabled: !!productId },
	) as {
		data:
			| {
					labels: Array<{
						id: string;
						displayText: string;
						type: string;
						color?: string;
						backgroundColor?: string;
						icon?: string;
					}>;
			  }
			| undefined;
	};

	return data?.labels ?? [];
}

export function useAnalyticsApi() {
	const client = useModuleClient();
	return {
		recentlyViewed:
			client.module("analytics").store["/analytics/recently-viewed"],
	};
}

export function useProductQaApi() {
	const client = useModuleClient();
	return {
		listProductQuestions:
			client.module("product-qa").store[
				"/product-qa/products/:productId/questions"
			],
		productQaSummary:
			client.module("product-qa").store[
				"/product-qa/products/:productId/summary"
			],
		submitQuestion: client.module("product-qa").store["/product-qa/questions"],
		listAnswers:
			client.module("product-qa").store[
				"/product-qa/questions/:questionId/answers"
			],
		upvoteQuestion:
			client.module("product-qa").store["/product-qa/questions/:id/upvote"],
		upvoteAnswer:
			client.module("product-qa").store["/product-qa/answers/:id/upvote"],
	};
}

export function useBrandsApi() {
	const client = useModuleClient();
	return {
		getProductBrand:
			client.module("brands").store["/brands/product/:productId"],
	};
}

export function useBackordersApi() {
	const client = useModuleClient();
	return {
		checkEligibility:
			client.module("backorders").store["/backorders/check/:productId"],
		createBackorder: client.module("backorders").store["/backorders/create"],
	};
}

export function usePreordersApi() {
	const client = useModuleClient();
	return {
		checkAvailability:
			client.module("preorders").store["/preorders/check/:productId"],
		placePreorder: client.module("preorders").store["/preorders/place"],
	};
}

export function useLoyaltyApi() {
	const client = useModuleClient();
	return {
		calculatePoints: client.module("loyalty").store["/loyalty/calculate"],
		getBalance: client.module("loyalty").store["/loyalty/balance"],
	};
}

export function useComparisonApi() {
	const client = useModuleClient();
	return {
		listComparison: client.module("comparisons").store["/comparisons"],
		addProduct: client.module("comparisons").store["/comparisons/add"],
		removeProduct: client.module("comparisons").store["/comparisons/remove"],
	};
}

export function useWishlistApi() {
	const client = useModuleClient();
	return {
		checkWishlist:
			client.module("wishlist").store["/wishlist/check/:productId"],
		addToWishlist: client.module("wishlist").store["/wishlist/add"],
		removeFromWishlist: client.module("wishlist").store["/wishlist/remove/:id"],
	};
}

export function useRecommendationsApi() {
	const client = useModuleClient();
	return {
		getForProduct:
			client.module("recommendations").store["/recommendations/:productId"],
		getTrending:
			client.module("recommendations").store["/recommendations/trending"],
	};
}

export function useSocialSharingApi() {
	const client = useModuleClient();
	return {
		share: client.module("social-sharing").store["/social-sharing/share"],
		getCount: client.module("social-sharing").store["/social-sharing/count"],
	};
}

/** Fire-and-forget analytics event via the analytics module endpoint. */
export function useTrack() {
	const client = useModuleClient();
	const tracker = client.module("analytics").store["/analytics/events"];
	const ref = useRef(tracker);
	ref.current = tracker;

	return useCallback(
		(params: {
			type: string;
			productId?: string;
			value?: number;
			data?: Record<string, unknown>;
		}) => {
			try {
				void ref.current.mutate(params);
			} catch {
				// Analytics is best-effort
			}
		},
		[],
	);
}
