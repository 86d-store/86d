"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReviewListTemplate from "./review-list.mdx";

interface Review {
	id: string;
	productId: string;
	customerId: string;
	authorName: string;
	authorEmail: string;
	rating: number;
	title?: string;
	body: string;
	status: "pending" | "approved" | "rejected";
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	createdAt: string;
	updatedAt: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Pending", value: "pending" },
	{ label: "Approved", value: "approved" },
	{ label: "Rejected", value: "rejected" },
];

const PAGE_SIZE = 20;

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useReviewsAdminApi() {
	const client = useModuleClient();
	return {
		listReviews: client.module("reviews").admin["/admin/reviews"],
		approveReview: client.module("reviews").admin["/admin/reviews/:id/approve"],
		rejectReview: client.module("reviews").admin["/admin/reviews/:id/reject"],
		deleteReview: client.module("reviews").admin["/admin/reviews/:id/delete"],
	};
}

function StarDisplay({ rating }: { rating: number }) {
	return (
		<span
			role="img"
			className="select-none text-sm leading-none"
			aria-label={`${rating} out of 5 stars`}
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<span
					key={n}
					className={
						n <= Math.round(rating)
							? "text-amber-400"
							: "text-muted-foreground/50"
					}
				>
					★
				</span>
			))}
		</span>
	);
}

function StatusBadge({ status }: { status: Review["status"] }) {
	const styles: Record<Review["status"], string> = {
		pending:
			"bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
		approved:
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	};

	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${styles[status]}`}
		>
			{status}
		</span>
	);
}

export function ReviewList() {
	const api = useReviewsAdminApi();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [skip, setSkip] = useState(0);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const queryInput =
		statusFilter === "all"
			? { take: String(PAGE_SIZE), skip: String(skip) }
			: {
					status: statusFilter,
					take: String(PAGE_SIZE),
					skip: String(skip),
				};

	const {
		data,
		isLoading: loading,
		isError: reviewsError,
		refetch: refetchReviews,
	} = api.listReviews.useQuery(queryInput) as {
		data: { reviews: Review[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const reviews = data?.reviews ?? [];
	const total = data?.total ?? 0;

	const approveMutation = api.approveReview.useMutation({
		onSettled: () => {
			setActionLoading(null);
			void api.listReviews.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to approve review."));
		},
	});

	const rejectMutation = api.rejectReview.useMutation({
		onSettled: () => {
			setActionLoading(null);
			void api.listReviews.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to reject review."));
		},
	});

	const deleteMutation = api.deleteReview.useMutation({
		onSettled: () => {
			setActionLoading(null);
			void api.listReviews.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete review."));
		},
	});

	if (reviewsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load reviews</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchReviews()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const handleApprove = (id: string) => {
		setActionLoading(id);
		setError("");
		approveMutation.mutate({ params: { id } });
	};

	const handleReject = (id: string) => {
		setActionLoading(id);
		setError("");
		rejectMutation.mutate({ params: { id } });
	};

	const handleDelete = (id: string) => {
		setActionLoading(id);
		setDeleteConfirm(null);
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const handleFilterChange = (filter: StatusFilter) => {
		setStatusFilter(filter);
		setSkip(0);
	};

	const hasPrev = skip > 0;
	const hasNext = skip + PAGE_SIZE < total;
	const showingFrom = reviews.length > 0 ? skip + 1 : 0;
	const showingTo = Math.min(skip + PAGE_SIZE, total);

	const tableBody =
		loading && reviews.length === 0 ? (
			Array.from({ length: 5 }, (_, _i) => (
				<tr key={rowKey}>
					{Array.from({ length: 7 }, (_, _j) => (
						<td key={cellKey} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : reviews.length === 0 ? (
			<tr>
				<td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
					No reviews found.
				</td>
			</tr>
		) : (
			reviews.map((review) => (
				<tr
					key={review.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3">
						<StarDisplay rating={review.rating} />
					</td>
					<td className="px-4 py-3 text-foreground">{review.authorName}</td>
					<td className="max-w-xs px-4 py-3">
						{review.title && (
							<p className="truncate font-medium text-foreground">
								{review.title}
							</p>
						)}
						<p className="truncate text-muted-foreground">{review.body}</p>
					</td>
					<td className="px-4 py-3">
						<code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{review.productId}
						</code>
					</td>
					<td className="px-4 py-3">
						<StatusBadge status={review.status} />
					</td>
					<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
						{formatDate(review.createdAt)}
					</td>
					<td className="px-4 py-3 text-right">
						{deleteConfirm === review.id ? (
							<span className="inline-flex items-center gap-1.5">
								<span className="text-muted-foreground text-xs">Delete?</span>
								<button
									type="button"
									disabled={actionLoading === review.id}
									onClick={() => handleDelete(review.id)}
									className="rounded px-2 py-1 font-medium text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
								>
									Confirm
								</button>
								<button
									type="button"
									onClick={() => setDeleteConfirm(null)}
									className="rounded px-2 py-1 font-medium text-muted-foreground text-xs hover:bg-muted"
								>
									Cancel
								</button>
							</span>
						) : (
							<span className="inline-flex items-center gap-1">
								<a
									href={`/admin/reviews/${review.id}`}
									className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
								>
									View
								</a>
								{review.status !== "approved" && (
									<button
										type="button"
										disabled={actionLoading === review.id}
										onClick={() => handleApprove(review.id)}
										className="rounded px-2 py-1 font-medium text-emerald-600 text-xs hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
									>
										Approve
									</button>
								)}
								{review.status !== "rejected" && (
									<button
										type="button"
										disabled={actionLoading === review.id}
										onClick={() => handleReject(review.id)}
										className="rounded px-2 py-1 font-medium text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
									>
										Reject
									</button>
								)}
								<button
									type="button"
									disabled={actionLoading === review.id}
									onClick={() => setDeleteConfirm(review.id)}
									className="rounded px-2 py-1 font-medium text-destructive text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
								>
									Delete
								</button>
							</span>
						)}
					</td>
				</tr>
			))
		);

	return (
		<ReviewListTemplate
			total={total}
			statusFilters={STATUS_FILTERS}
			statusFilter={statusFilter}
			onFilterChange={handleFilterChange}
			error={error}
			tableBody={tableBody}
			showingFrom={showingFrom}
			showingTo={showingTo}
			hasPrev={hasPrev}
			hasNext={hasNext}
			loading={loading}
			onPrevPage={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
			onNextPage={() => setSkip((s) => s + PAGE_SIZE)}
		/>
	);
}
