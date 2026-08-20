"use client";

import { useCallback, useState } from "react";
import { useReviewsApi } from "./_hooks";
import type { Review, ReviewsResponse } from "./_types";
import { formatDate } from "./_utils";
import ProductReviewsSectionTemplate from "./product-reviews-section.mdx";
import { StarDisplay } from "./star-display";
import { StarPicker } from "./star-picker";

const REVIEWS_PAGE_SIZE = 10;

export interface ProductReviewsSectionProps {
	productId: string;
}

export function ProductReviewsSection({
	productId,
}: ProductReviewsSectionProps) {
	const reviewsApi = useReviewsApi();

	const {
		data: initialData,
		isLoading: loading,
		isError: queryError,
		refetch,
	} = reviewsApi.listProductReviews.useQuery({
		params: { productId },
		take: String(REVIEWS_PAGE_SIZE),
		skip: "0",
	}) as {
		data: ReviewsResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const [extraReviews, setExtraReviews] = useState<Review[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [skip, setSkip] = useState(0);
	const [loadedAll, setLoadedAll] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const [rating, setRating] = useState(0);
	const [reviewName, setReviewName] = useState("");
	const [reviewEmail, setReviewEmail] = useState("");
	const [reviewTitle, setReviewTitle] = useState("");
	const [reviewBody, setReviewBody] = useState("");
	const [ratingError, setRatingError] = useState("");

	const allReviews = [...(initialData?.reviews ?? []), ...extraReviews];
	const summary = initialData?.summary ?? null;
	const hasMore =
		!loadedAll &&
		initialData !== undefined &&
		(initialData.reviews.length === REVIEWS_PAGE_SIZE ||
			extraReviews.length > 0);

	const submitMutation = reviewsApi.submitReview.useMutation({
		onSuccess: () => {
			setShowForm(false);
			setRating(0);
			setReviewName("");
			setReviewEmail("");
			setReviewTitle("");
			setReviewBody("");
			void reviewsApi.listProductReviews.invalidate();
			setExtraReviews([]);
			setSkip(0);
			setLoadedAll(false);
		},
	});

	const handleLoadMore = useCallback(async () => {
		const nextSkip = skip === 0 ? REVIEWS_PAGE_SIZE : skip + REVIEWS_PAGE_SIZE;
		setLoadingMore(true);
		try {
			const fresh = (await reviewsApi.listProductReviews.fetch({
				params: { productId },
				take: String(REVIEWS_PAGE_SIZE),
				skip: String(nextSkip),
			})) as ReviewsResponse;
			setExtraReviews((prev) => [...prev, ...fresh.reviews]);
			setSkip(nextSkip);
			if (fresh.reviews.length < REVIEWS_PAGE_SIZE) setLoadedAll(true);
		} catch {
			// silently ignore
		} finally {
			setLoadingMore(false);
		}
	}, [reviewsApi.listProductReviews, productId, skip]);

	const handleSubmitReview = (e: React.FormEvent) => {
		e.preventDefault();
		if (rating === 0) {
			setRatingError("Please select a rating.");
			return;
		}
		setRatingError("");
		submitMutation.mutate({
			productId,
			authorName: reviewName,
			authorEmail: reviewEmail,
			rating,
			title: reviewTitle.trim() || undefined,
			body: reviewBody,
		});
	};

	if (loading) {
		return (
			<section id="reviews" className="border-border/50 border-t py-10">
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
			<section id="reviews" className="border-border/50 border-t py-10">
				<h2 className="font-display font-semibold text-foreground text-lg tracking-tight">
					Customer Reviews
				</h2>
				<div
					className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center"
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

	const noReviews = summary === null || summary.count === 0;
	const submitError =
		ratingError || (submitMutation.isError ? "Failed to submit review." : "");

	// --- Pre-computed JSX blocks for template ---

	const summaryDisplay =
		!noReviews && summary ? (
			<div className="mt-1 flex items-center gap-2">
				<StarDisplay rating={summary.average} size="lg" />
				<span className="font-medium text-foreground">
					{summary.average.toFixed(1)}
				</span>
				<span className="text-muted-foreground text-sm">
					({summary.count} review{summary.count !== 1 ? "s" : ""})
				</span>
			</div>
		) : null;

	const toggleFormButton = (
		<button
			type="button"
			onClick={() => setShowForm((v) => !v)}
			className="rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
		>
			{showForm ? "Cancel" : "Write a Review"}
		</button>
	);

	let formContent: React.ReactNode = null;
	if (showForm) {
		formContent = (
			<div className="mb-8">
				{submitMutation.isSuccess ? (
					<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
						<p className="font-semibold text-emerald-800 dark:text-emerald-200">
							Thank you for your review!
						</p>
						<p className="mt-1 text-emerald-700 text-sm dark:text-emerald-300">
							Your review will appear once approved.
						</p>
					</div>
				) : (
					<form
						onSubmit={handleSubmitReview}
						className="space-y-4 rounded-lg border border-border bg-muted/30 p-5"
					>
						<div>
							<p className="mb-1.5 font-medium text-foreground text-sm">
								Your rating <span className="text-destructive">*</span>
							</p>
							<StarPicker value={rating} onChange={setRating} />
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label
									htmlFor="pdp-review-name"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									id="pdp-review-name"
									type="text"
									required
									maxLength={200}
									value={reviewName}
									onChange={(e) => setReviewName(e.target.value)}
									placeholder="Your name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
								/>
							</div>
							<div>
								<label
									htmlFor="pdp-review-email"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Email <span className="text-destructive">*</span>
								</label>
								<input
									id="pdp-review-email"
									type="email"
									required
									value={reviewEmail}
									onChange={(e) => setReviewEmail(e.target.value)}
									placeholder="you@example.com"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="pdp-review-title"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Title
							</label>
							<input
								id="pdp-review-title"
								type="text"
								maxLength={500}
								value={reviewTitle}
								onChange={(e) => setReviewTitle(e.target.value)}
								placeholder="Summary of your experience"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
							/>
						</div>

						<div>
							<label
								htmlFor="pdp-review-body"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Review <span className="text-destructive">*</span>
							</label>
							<textarea
								id="pdp-review-body"
								required
								maxLength={10000}
								rows={4}
								value={reviewBody}
								onChange={(e) => setReviewBody(e.target.value)}
								placeholder="Share your experience with this product"
								className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
							/>
						</div>

						{submitError && (
							<p className="text-destructive text-sm" role="alert">
								{submitError}
							</p>
						)}

						<button
							type="submit"
							disabled={submitMutation.isPending}
							className="rounded-md bg-foreground px-5 py-2 font-medium text-background text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
						>
							{submitMutation.isPending ? "Submitting…" : "Submit Review"}
						</button>
					</form>
				)}
			</div>
		);
	}

	const emptyState =
		noReviews && !showForm ? (
			<div className="rounded-lg border border-border bg-muted/30 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No reviews yet</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Be the first to review this product.
				</p>
			</div>
		) : null;

	let reviewsContent: React.ReactNode = null;
	if (!noReviews && summary) {
		reviewsContent = (
			<div className="flex flex-col gap-5 sm:flex-row sm:items-start">
				<div className="sm:w-48">
					<div className="space-y-1.5">
						{[5, 4, 3, 2, 1].map((n) => {
							const count = summary.distribution[String(n)] ?? 0;
							const pct = summary.count > 0 ? (count / summary.count) * 100 : 0;
							return (
								<div key={n} className="flex items-center gap-2 text-sm">
									<span className="w-3 text-right text-muted-foreground">
										{n}
									</span>
									<span className="text-amber-400 text-xs">★</span>
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-amber-400 transition-all"
											style={{ width: `${pct}%` }}
										/>
									</div>
									<span className="w-5 text-right text-muted-foreground/70 text-xs">
										{count}
									</span>
								</div>
							);
						})}
					</div>
				</div>
				<div className="hidden h-auto w-px bg-border sm:block" />
				<div className="flex-1">
					{allReviews.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No approved reviews yet.
						</p>
					) : (
						<div>
							{allReviews.map((review) => (
								<article
									key={review.id}
									className="border-border border-b py-5 last:border-0"
								>
									<div className="mb-2 flex items-start justify-between gap-3">
										<div>
											<div className="flex items-center gap-2">
												<StarDisplay rating={review.rating} size="sm" />
												{review.isVerifiedPurchase && (
													<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 text-xs dark:bg-emerald-950 dark:text-emerald-300">
														Verified
													</span>
												)}
											</div>
											{review.title && (
												<p className="mt-1 font-medium text-foreground text-sm">
													{review.title}
												</p>
											)}
										</div>
										<span className="shrink-0 text-muted-foreground text-xs">
											{formatDate(review.createdAt)}
										</span>
									</div>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{review.body}
									</p>
									<p className="mt-2 text-muted-foreground text-xs">
										— {review.authorName}
									</p>
								</article>
							))}
							{hasMore && (
								<button
									type="button"
									onClick={() => void handleLoadMore()}
									disabled={loadingMore}
									className="mt-4 text-foreground text-sm underline-offset-4 hover:underline disabled:opacity-60"
								>
									{loadingMore ? "Loading…" : "Load more reviews"}
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<ProductReviewsSectionTemplate
			summaryDisplay={summaryDisplay}
			toggleFormButton={toggleFormButton}
			formContent={formContent}
			emptyState={emptyState}
			reviewsContent={reviewsContent}
		/>
	);
}
