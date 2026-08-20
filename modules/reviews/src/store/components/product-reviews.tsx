"use client";

import { useCallback, useState } from "react";
import { useReviewsApi } from "./_hooks";
import { DistributionBars } from "./distribution-bars";
import ProductReviewsTemplate from "./product-reviews.mdx";
import { ReviewCard } from "./review-card";
import { ReviewForm } from "./review-form";
import { StarDisplay } from "./star-display";

interface Review {
	id: string;
	authorName: string;
	rating: number;
	title?: string | undefined;
	body: string;
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	merchantResponse?: string | undefined;
	merchantResponseAt?: string | undefined;
	createdAt: string;
}

interface RatingSummary {
	average: number;
	count: number;
	distribution: Record<string, number>;
}

interface ReviewsResponse {
	reviews: Review[];
	summary: RatingSummary;
	total: number;
}

const PAGE_SIZE = 10;

export function ProductReviews({
	productId,
	title = "Customer Reviews",
}: {
	productId: string;
	title?: string | undefined;
}) {
	const api = useReviewsApi();

	// Initial page via useQuery — eliminates the fetch-on-mount useEffect
	const {
		data: initialData,
		isLoading: loading,
		isError: queryError,
		refetch,
	} = api.listProductReviews.useQuery({
		params: { productId },
		take: String(PAGE_SIZE),
		skip: "0",
	}) as {
		data: ReviewsResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	// Extra reviews loaded via "Load more"
	const [extraReviews, setExtraReviews] = useState<Review[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [skip, setSkip] = useState(0);
	const [loadedAll, setLoadedAll] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const allReviews = [...(initialData?.reviews ?? []), ...extraReviews];
	const hasMore =
		!loadedAll &&
		initialData !== undefined &&
		(initialData.reviews.length === PAGE_SIZE || extraReviews.length > 0);

	const handleLoadMore = useCallback(async () => {
		const nextSkip = skip === 0 ? PAGE_SIZE : skip + PAGE_SIZE;
		setLoadingMore(true);
		try {
			const fresh = (await api.listProductReviews.fetch({
				params: { productId },
				take: String(PAGE_SIZE),
				skip: String(nextSkip),
			})) as ReviewsResponse;
			setExtraReviews((prev) => [...prev, ...fresh.reviews]);
			setSkip(nextSkip);
			if (fresh.reviews.length < PAGE_SIZE) setLoadedAll(true);
		} catch {
			// silently ignore
		} finally {
			setLoadingMore(false);
		}
	}, [api.listProductReviews, productId, skip]);

	const handleMarkHelpful = useCallback(
		async (id: string) => {
			await api.markHelpful.mutate({ params: { id } });
		},
		[api.markHelpful],
	);

	const handleReviewSubmitted = useCallback(() => {
		setShowForm(false);
		// Invalidate the query to refetch from scratch
		void api.listProductReviews.invalidate();
		setExtraReviews([]);
		setSkip(0);
		setLoadedAll(false);
	}, [api.listProductReviews]);

	if (loading) {
		return (
			<section className="py-8">
				<div className="mb-6 h-7 w-40 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-4">
					{[1, 2, 3].map((n) => (
						<div key={n} className="space-y-2 border-border border-b pb-4">
							<div className="h-4 w-24 animate-pulse rounded bg-muted" />
							<div className="h-4 w-full animate-pulse rounded bg-muted" />
							<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</section>
		);
	}

	if (queryError) {
		return (
			<section className="py-8">
				<h2 className="mb-4 font-semibold text-foreground text-lg">{title}</h2>
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center"
					role="alert"
				>
					<p className="font-medium text-destructive text-sm">
						Failed to load reviews
					</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-2 font-medium text-destructive text-sm underline underline-offset-4"
					>
						Try again
					</button>
				</div>
			</section>
		);
	}

	const summary = initialData?.summary;
	const noReviews = !summary || summary.count === 0;

	const reviewListContent =
		allReviews.length === 0 ? (
			<p className="text-muted-foreground text-sm">No approved reviews yet.</p>
		) : (
			<div>
				{allReviews.map((review) => (
					<ReviewCard
						key={review.id}
						review={review}
						onMarkHelpful={handleMarkHelpful}
					/>
				))}
				{hasMore && (
					<button
						type="button"
						onClick={() => void handleLoadMore()}
						disabled={loadingMore}
						className="mt-4 text-primary text-sm underline-offset-4 hover:underline disabled:opacity-60"
					>
						{loadingMore ? "Loading…" : "Load more reviews"}
					</button>
				)}
			</div>
		);

	return (
		<ProductReviewsTemplate
			title={title}
			summary={summary ?? undefined}
			noReviews={noReviews}
			showForm={showForm}
			onToggleForm={() => setShowForm((v) => !v)}
			formContent={
				<ReviewForm productId={productId} onSuccess={handleReviewSubmitted} />
			}
			distributionBars={
				summary ? (
					<DistributionBars
						distribution={summary.distribution}
						total={summary.count}
					/>
				) : null
			}
			reviewListContent={reviewListContent}
			starDisplay={
				summary ? <StarDisplay rating={summary.average} size="lg" /> : null
			}
		/>
	);
}
