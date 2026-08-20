"use client";

import { useSocialProofApi } from "./_hooks";
import { formatCount } from "./_utils";
import ProductActivityTemplate from "./product-activity.mdx";

interface ActivityData {
	productId: string;
	viewCount: number;
	purchaseCount: number;
	cartAddCount: number;
	wishlistAddCount: number;
	totalEvents: number;
	recentPurchases: Array<{
		region?: string;
		city?: string;
		country?: string;
		quantity?: number;
		createdAt: string;
	}>;
}

export function ProductActivity({
	productId,
	period = "24h",
}: {
	productId: string;
	period?: string;
}) {
	const api = useSocialProofApi();

	const { data, isLoading } = api.getProductActivity.useQuery({
		productId,
		period,
	}) as {
		data: { activity: ActivityData } | undefined;
		isLoading: boolean;
	};

	const activity = data?.activity;

	if (isLoading || !activity || activity.totalEvents === 0) return null;

	return (
		<ProductActivityTemplate
			viewCount={formatCount(activity.viewCount)}
			purchaseCount={formatCount(activity.purchaseCount)}
			cartAddCount={formatCount(activity.cartAddCount)}
			hasViews={activity.viewCount > 0}
			hasPurchases={activity.purchaseCount > 0}
			hasCartAdds={activity.cartAddCount > 0}
			recentPurchases={activity.recentPurchases.slice(0, 3)}
		/>
	);
}
