"use client";

import { useState } from "react";
import { useRecentlyViewedApi } from "./_hooks";
import { extractError, formatPrice, timeAgo } from "./_utils";
import RecentlyViewedGridTemplate from "./recently-viewed-grid.mdx";

export function RecentlyViewedGrid({
	customerId,
	sessionId,
	limit,
	title,
	showClear,
}: {
	customerId?: string | undefined;
	sessionId?: string | undefined;
	limit?: number | undefined;
	title?: string | undefined;
	showClear?: boolean | undefined;
}) {
	const api = useRecentlyViewedApi();
	const [error, setError] = useState("");

	const queryParams = customerId
		? { take: limit ?? 12 }
		: sessionId
			? { sessionId, take: limit ?? 12 }
			: { take: limit ?? 12 };

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
					total: number;
			  }
			| undefined;
		isLoading: boolean;
	};

	const clearMutation = api.clearHistory.useMutation({
		onSettled: () => {
			void api.listViews.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to clear history."));
		},
	});

	const handleClear = () => {
		setError("");
		clearMutation.mutate(sessionId && !customerId ? { sessionId } : {});
	};

	// Deduplicate by productId, keep most recent
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
		<RecentlyViewedGridTemplate
			title={title ?? "Recently Viewed"}
			views={uniqueViews}
			isLoading={isLoading}
			showClear={showClear ?? false}
			onClear={handleClear}
			clearing={clearMutation.isPending}
			error={error}
			formatPrice={formatPrice}
			timeAgo={timeAgo}
		/>
	);
}
