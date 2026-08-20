"use client";

import { useRecentlyViewedApi } from "./_hooks";
import { formatPrice } from "./_utils";
import RecentlyViewedCompactTemplate from "./recently-viewed-compact.mdx";

export function RecentlyViewedCompact({
	customerId,
	sessionId,
	limit,
	title,
}: {
	customerId?: string | undefined;
	sessionId?: string | undefined;
	limit?: number | undefined;
	title?: string | undefined;
}) {
	const api = useRecentlyViewedApi();

	const queryParams = customerId
		? { take: limit ?? 6 }
		: sessionId
			? { sessionId, take: limit ?? 6 }
			: { take: limit ?? 6 };

	const { data, isLoading } = api.listViews.useQuery(queryParams) as {
		data:
			| {
					views: Array<{
						id: string;
						productId: string;
						productName: string;
						productSlug: string;
						productImage?: string;
						productPrice?: number;
						viewedAt: string;
					}>;
			  }
			| undefined;
		isLoading: boolean;
	};

	// Deduplicate by productId
	const uniqueViews = data?.views
		? Array.from(
				data.views
					.reduce((map, v) => {
						if (!map.has(v.productId)) map.set(v.productId, v);
						return map;
					}, new Map<string, (typeof data.views)[0]>())
					.values(),
			)
		: [];

	if (!isLoading && uniqueViews.length === 0) return null;

	return (
		<RecentlyViewedCompactTemplate
			title={title ?? "Recently Viewed"}
			views={uniqueViews}
			isLoading={isLoading}
			formatPrice={formatPrice}
		/>
	);
}
