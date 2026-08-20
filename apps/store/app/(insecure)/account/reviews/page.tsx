"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { StarIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { buttonVariants } from "~/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface ReviewData {
	id: string;
	productId: string;
	rating: number;
	title?: string | undefined;
	body: string;
	status: "pending" | "approved" | "rejected";
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	merchantResponse?: string | undefined;
	merchantResponseAt?: string | undefined;
	moderationNote?: string | undefined;
	createdAt: string;
	updatedAt: string;
}

interface ReviewsListResponse {
	reviews: ReviewData[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

const STATUS_FILTERS = [
	{ label: "All", value: "" },
	{ label: "Pending", value: "pending" },
	{ label: "Approved", value: "approved" },
	{ label: "Rejected", value: "rejected" },
] as const;

function StarRating({ rating }: { rating: number }) {
	return (
		<div
			className="flex items-center gap-0.5"
			role="img"
			aria-label={`${rating} out of 5 stars`}
		>
			{[1, 2, 3, 4, 5].map((star) => (
				<svg
					key={star}
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill={star <= rating ? "currentColor" : "none"}
					stroke="currentColor"
					strokeWidth="1.5"
					className={
						star <= rating ? "text-amber-500" : "text-muted-foreground/30"
					}
					aria-hidden="true"
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
			))}
		</div>
	);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MyReviewsPage() {
	const client = useModuleClient();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");

	const reviewsApi = client.module("reviews").store["/reviews/me"];

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: "10",
	};
	if (statusFilter) {
		queryInput.status = statusFilter;
	}

	const { data, isLoading, isError, refetch } = reviewsApi.useQuery(
		queryInput,
	) as {
		data: ReviewsListResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const reviews = data?.reviews ?? [];
	const pages = data?.pages ?? 1;
	const total = data?.total ?? 0;

	return (
		<div>
			{/* Header */}
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					My Reviews
				</h2>
				{total > 0 && (
					<p className="mt-1 text-muted-foreground text-sm">
						{total} review{total !== 1 ? "s" : ""} submitted
					</p>
				)}
			</div>

			{/* Status filter */}
			<div className="scrollbar-none -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1">
				{STATUS_FILTERS.map((f) => (
					<button
						key={f.value}
						type="button"
						onClick={() => {
							setStatusFilter(f.value);
							setPage(1);
						}}
						className={`shrink-0 rounded-full border px-3 py-1.5 font-medium text-xs transition-colors ${
							statusFilter === f.value
								? "border-foreground bg-foreground text-background"
								: "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
						}`}
					>
						{f.label}
					</button>
				))}
			</div>

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your reviews.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			) : isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((n) => (
						<Skeleton key={n} className="h-28 rounded-xl" />
					))}
				</div>
			) : reviews.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<StarIcon />
						</EmptyMedia>
						<EmptyTitle>
							{statusFilter ? "No matching reviews" : "No reviews yet"}
						</EmptyTitle>
						<EmptyDescription>
							{statusFilter
								? "Try adjusting your filter."
								: "Share your thoughts on products you've purchased."}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<a href="/products" className={buttonVariants()}>
							Browse products
						</a>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<div className="flex flex-col gap-3">
						{reviews.map((review) => (
							<div
								key={review.id}
								className="rounded-xl border border-border p-4"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<StarRating rating={review.rating} />
											<StatusBadge status={review.status} />
											{review.isVerifiedPurchase && (
												<span className="inline-flex items-center gap-1 text-status-success text-xs">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="12"
														height="12"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
														aria-hidden="true"
													>
														<path d="M20 6 9 17l-5-5" />
													</svg>
													Verified
												</span>
											)}
										</div>
										{review.title && (
											<p className="mt-2 font-semibold text-foreground text-sm">
												{review.title}
											</p>
										)}
										<p className="mt-1 text-foreground/80 text-sm leading-relaxed">
											{review.body}
										</p>
									</div>
									<div className="shrink-0 text-right">
										<p className="text-muted-foreground text-xs">
											{formatDate(review.createdAt)}
										</p>
										{review.helpfulCount > 0 && (
											<p className="mt-1 text-muted-foreground text-xs">
												{review.helpfulCount} found helpful
											</p>
										)}
									</div>
								</div>

								{/* Merchant response */}
								{review.merchantResponse && (
									<div className="mt-3 rounded-lg bg-muted/40 p-3">
										<p className="mb-1 text-muted-foreground text-xs">
											Store response
										</p>
										<p className="text-foreground text-sm">
											{review.merchantResponse}
										</p>
										{review.merchantResponseAt && (
											<p className="mt-1 text-muted-foreground text-xs">
												{formatDate(review.merchantResponseAt)}
											</p>
										)}
									</div>
								)}

								{/* Rejection note */}
								{review.status === "rejected" && review.moderationNote && (
									<div className="mt-3 rounded-lg bg-status-danger-bg/50 p-3">
										<p className="mb-1 text-status-danger text-xs">
											Moderation note
										</p>
										<p className="text-foreground text-sm">
											{review.moderationNote}
										</p>
									</div>
								)}

								{/* Product link */}
								<div className="mt-3 border-border border-t pt-2">
									<a
										href={`/products/${review.productId}`}
										className="text-muted-foreground text-xs transition-colors hover:text-foreground"
									>
										View product →
									</a>
								</div>
							</div>
						))}
					</div>

					{/* Pagination */}
					{pages > 1 && (
						<div className="mt-6 flex items-center justify-center gap-2">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
								className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
							>
								Previous
							</button>
							<span className="px-2 text-muted-foreground text-sm">
								Page {page} of {pages}
							</span>
							<button
								type="button"
								disabled={page >= pages}
								onClick={() => setPage((p) => p + 1)}
								className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
