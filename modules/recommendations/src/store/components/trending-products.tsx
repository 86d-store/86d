"use client";

import { useRecommendationsApi } from "./_hooks";
import { formatPrice } from "./_utils";
import TrendingProductsTemplate from "./trending-products.mdx";

interface RecommendedProduct {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
	score: number;
	strategy: string;
}

export interface TrendingProductsProps {
	/** Section title */
	title?: string | undefined;
	/** Max number of products */
	limit?: number | undefined;
}

export function TrendingProducts({
	title = "Trending now",
	limit = 8,
}: TrendingProductsProps) {
	const api = useRecommendationsApi();
	const recordClick = api.recordClick.useMutation() as {
		mutate: (opts: { body: Record<string, unknown> }) => void;
	};

	const { data, isLoading } = api.getTrending.useQuery({
		...(limit ? { take: String(limit) } : {}),
	}) as {
		data:
			| {
					recommendations: RecommendedProduct[];
					impressionId?: string | null;
			  }
			| undefined;
		isLoading: boolean;
	};

	const recommendations = data?.recommendations ?? [];
	const impressionId = data?.impressionId ?? null;

	if (!isLoading && recommendations.length === 0) {
		return null;
	}

	const items = recommendations.map((r, index) => ({
		id: r.productId,
		name: r.productName,
		slug: r.productSlug,
		image: r.productImage,
		price: r.productPrice != null ? formatPrice(r.productPrice) : undefined,
		href: `/products/${r.productSlug}`,
		onClick: () => {
			if (!impressionId) return;
			recordClick.mutate({
				body: {
					impressionId,
					productId: r.productId,
					position: index,
					strategy: r.strategy,
				},
			});
		},
	}));

	return (
		<TrendingProductsTemplate
			title={title}
			items={items}
			isLoading={isLoading}
		/>
	);
}
