"use client";

import { useReviewsApi } from "./_hooks";
import ReviewsSummaryTemplate from "./reviews-summary.mdx";
import { StarDisplay } from "./star-display";

interface ReviewsResponse {
	reviews: unknown[];
	summary: { average: number; count: number };
	total: number;
}

export function ReviewsSummary({ productId }: { productId: string }) {
	const api = useReviewsApi();
	const { data } = api.listProductReviews.useQuery({
		params: { productId },
		take: "1",
	}) as { data: ReviewsResponse | undefined };

	const summary = data?.summary;
	if (!summary || summary.count === 0) return null;

	return (
		<ReviewsSummaryTemplate
			starDisplay={<StarDisplay rating={summary.average} size="sm" />}
			averageFormatted={summary.average.toFixed(1)}
			countLabel={summary.count === 1 ? "1 review" : `${summary.count} reviews`}
		/>
	);
}
