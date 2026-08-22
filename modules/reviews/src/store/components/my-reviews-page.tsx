"use client";

import { useState } from "react";
import { useReviewsApi } from "./_hooks";
import { formatDate } from "./_utils";
import MyReviewsPageTemplate from "./my-reviews-page.mdx";
import { StarDisplay } from "./star-display";

interface MyReview {
	id: string;
	productId: string;
	productName?: string | undefined;
	rating: number;
	title?: string | undefined;
	body: string;
	status: string;
	createdAt: string;
}

interface MyReviewsResponse {
	reviews: MyReview[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export function MyReviewsPage() {
	const api = useReviewsApi();
	const [page, setPage] = useState(1);

	const {
		data,
		isLoading: loading,
		isError: queryError,
		refetch,
	} = api.listMyReviews.useQuery({ page: String(page), limit: "10" }) as {
		data: MyReviewsResponse | { error: string; status: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const isUnauthenticated =
		!loading && (data as { status?: number } | undefined)?.status === 401;
	const successData = data as MyReviewsResponse | undefined;
	const reviews = successData?.reviews ?? [];
	const totalPages = successData?.pages ?? 1;

	if (isUnauthenticated) {
		return (
			<div className="py-16 text-center">
				<p className="text-4xl">⭐</p>
				<h2 className="mt-4 font-semibold text-foreground text-lg">
					Your Reviews
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Sign in to view the reviews you've written.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="space-y-4">
				{(["k0", "k1", "k2"] as const).map((key) => (
					<div
						key={key}
						className="space-y-3 rounded-xl border border-border p-4"
					>
						<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
						<div className="h-3 w-16 animate-pulse rounded bg-muted" />
						<div className="h-4 w-full animate-pulse rounded bg-muted" />
						<div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
					</div>
				))}
			</div>
		);
	}

	if (queryError) {
		return (
			<div className="py-16 text-center" role="alert">
				<p className="text-4xl">⭐</p>
				<h2 className="mt-4 font-semibold text-foreground text-lg">
					Failed to load reviews
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Something went wrong. Please try again.
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
				>
					Try again
				</button>
			</div>
		);
	}

	const statusBadge = (status: string) => {
		const map: Record<string, { label: string; className: string }> = {
			approved: {
				label: "Approved",
				className:
					"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
			},
			pending: {
				label: "Pending",
				className:
					"bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
			},
			rejected: {
				label: "Rejected",
				className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
			},
		};
		const s = map[status] ?? {
			label: status,
			className: "bg-muted text-muted-foreground",
		};
		return (
			<span
				className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${s.className}`}
			>
				{s.label}
			</span>
		);
	};

	const reviewsContent =
		reviews.length === 0 ? null : (
			<div className="space-y-4">
				{reviews.map((review) => (
					<div
						key={review.id}
						className="rounded-xl border border-border bg-card p-4"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								{review.productName && (
									<p className="truncate font-medium text-foreground text-sm">
										{review.productName}
									</p>
								)}
								<div className="mt-1 flex items-center gap-2">
									<StarDisplay rating={review.rating} size="sm" />
									{statusBadge(review.status)}
								</div>
							</div>
							<time className="shrink-0 text-muted-foreground text-xs">
								{formatDate(review.createdAt)}
							</time>
						</div>
						{review.title && (
							<p className="mt-2 font-medium text-foreground text-sm">
								{review.title}
							</p>
						)}
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							{review.body}
						</p>
					</div>
				))}
			</div>
		);

	const pagination =
		totalPages > 1 ? (
			<div className="mt-6 flex items-center justify-center gap-2">
				<button
					type="button"
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page === 1}
					className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
				>
					Previous
				</button>
				<span className="text-muted-foreground text-sm">
					Page {page} of {totalPages}
				</span>
				<button
					type="button"
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page === totalPages}
					className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
				>
					Next
				</button>
			</div>
		) : null;

	return (
		<MyReviewsPageTemplate
			reviewCount={successData?.total ?? 0}
			reviewsContent={reviewsContent}
			pagination={pagination}
		/>
	);
}
