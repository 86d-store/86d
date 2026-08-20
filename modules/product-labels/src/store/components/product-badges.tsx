"use client";

import { useProductLabelsApi } from "./_hooks";
import ProductBadgesTemplate from "./product-badges.mdx";

interface LabelData {
	id: string;
	name: string;
	displayText: string;
	type: string;
	color?: string;
	backgroundColor?: string;
	icon?: string;
	priority: number;
}

export function ProductBadges({ productId }: { productId: string }) {
	const api = useProductLabelsApi();

	const { data, isLoading } = api.getProductLabels.useQuery({
		productId,
	}) as {
		data: { labels: LabelData[] } | undefined;
		isLoading: boolean;
	};

	const labels = data?.labels ?? [];

	if (isLoading || labels.length === 0) return null;

	return <ProductBadgesTemplate labels={labels} />;
}
