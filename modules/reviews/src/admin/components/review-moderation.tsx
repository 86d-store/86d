"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReviewModerationTemplate from "./review-moderation.mdx";

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
	merchantResponse?: string;
	merchantResponseAt?: string;
	moderationNote?: string;
	createdAt: string;
	updatedAt: string;
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
		getReview: client.module("reviews").admin["/admin/reviews/:id"],
		approveReview: client.module("reviews").admin["/admin/reviews/:id/approve"],
		rejectReview: client.module("reviews").admin["/admin/reviews/:id/reject"],
		respondReview: client.module("reviews").admin["/admin/reviews/:id/respond"],
		deleteReview: client.module("reviews").admin["/admin/reviews/:id/delete"],
	};
}

function StarDisplay({ rating }: { rating: number }) {
	return (
		<span
			role="img"
			className="select-none text-base leading-none"
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

export function ReviewModeration(props: {
	reviewId?: string;
	params?: Record<string, string>;
	onAction?: () => void;
}) {
	const reviewId = props.reviewId ?? props.params?.id ?? "";
	const onAction = props.onAction;
	const api = useReviewsAdminApi();
	const [deleted, setDeleted] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState(false);
	const [error, setError] = useState("");
	const [responseText, setResponseText] = useState("");
	const [showResponseForm, setShowResponseForm] = useState(false);

	const {
		data: reviewData,
		isLoading: loading,
		error: queryError,
	} = api.getReview.useQuery({ params: { id: reviewId } }) as {
		data: { review: Review } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const review = deleted ? null : (reviewData?.review ?? null);
	const queryErrorMsg = queryError
		? "Failed to load review. Please try again."
		: !loading && reviewData && !review && !deleted
			? "Review not found."
			: "";

	const approveMutation = api.approveReview.useMutation({
		onSuccess: () => {
			onAction?.();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to approve review."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getReview.invalidate();
		},
	});

	const rejectMutation = api.rejectReview.useMutation({
		onSuccess: () => {
			onAction?.();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to reject review."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getReview.invalidate();
		},
	});

	const respondMutation = api.respondReview.useMutation({
		onSuccess: () => {
			setShowResponseForm(false);
			setResponseText("");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save response."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getReview.invalidate();
		},
	});

	const deleteMutation = api.deleteReview.useMutation({
		onSuccess: () => {
			setDeleted(true);
			onAction?.();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete review."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getReview.invalidate();
		},
	});

	const handleApprove = () => {
		setActionLoading(true);
		setError("");
		approveMutation.mutate({ params: { id: reviewId } });
	};

	const handleReject = () => {
		setActionLoading(true);
		setError("");
		rejectMutation.mutate({ params: { id: reviewId } });
	};

	const handleDelete = () => {
		setActionLoading(true);
		setDeleteConfirm(false);
		setError("");
		deleteMutation.mutate({ params: { id: reviewId } });
	};

	const handleRespond = () => {
		if (!responseText.trim()) return;
		setActionLoading(true);
		setError("");
		respondMutation.mutate({
			params: { id: reviewId },
			body: { response: responseText.trim() },
		});
	};

	if (loading) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">Loading review...</p>
			</div>
		);
	}

	if ((queryErrorMsg || error) && !review) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-destructive text-sm" role="alert">
					{queryErrorMsg || error}
				</p>
			</div>
		);
	}

	if (!review) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">
					Review has been deleted.
				</p>
			</div>
		);
	}

	const content = (
		<div className="space-y-5 rounded-xl border border-border bg-card p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<StarDisplay rating={review.rating} />
						<StatusBadge status={review.status} />
						{review.isVerifiedPurchase && (
							<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 text-xs dark:bg-emerald-950 dark:text-emerald-300">
								Verified Purchase
							</span>
						)}
					</div>
					{review.title && (
						<h3 className="font-semibold text-foreground text-lg">
							{review.title}
						</h3>
					)}
				</div>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatDate(review.createdAt)}
				</span>
			</div>

			<p className="text-foreground text-sm leading-relaxed">{review.body}</p>

			<div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
				<div>
					<p className="font-medium text-muted-foreground text-xs">Author</p>
					<p className="mt-0.5 text-foreground text-sm">{review.authorName}</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs">Email</p>
					<p className="mt-0.5 text-foreground text-sm">{review.authorEmail}</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs">
						Product ID
					</p>
					<p className="mt-0.5">
						<code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{review.productId}
						</code>
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs">
						Helpful Count
					</p>
					<p className="mt-0.5 text-foreground text-sm">
						{review.helpfulCount}
					</p>
				</div>
			</div>

			{review.moderationNote && (
				<div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
					<p className="mb-1 font-medium text-amber-800 text-xs dark:text-amber-300">
						Moderation Note
					</p>
					<p className="text-amber-900 text-sm dark:text-amber-200">
						{review.moderationNote}
					</p>
				</div>
			)}

			{review.merchantResponse ? (
				<div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
					<div className="mb-1 flex items-center justify-between">
						<p className="font-medium text-blue-800 text-xs dark:text-blue-300">
							Merchant Response
						</p>
						{review.merchantResponseAt && (
							<span className="text-blue-600 text-xs dark:text-blue-400">
								{formatDate(review.merchantResponseAt)}
							</span>
						)}
					</div>
					<p className="text-blue-900 text-sm dark:text-blue-200">
						{review.merchantResponse}
					</p>
					<button
						type="button"
						onClick={() => {
							setResponseText(review.merchantResponse ?? "");
							setShowResponseForm(true);
						}}
						className="mt-2 text-blue-600 text-xs underline-offset-4 hover:underline dark:text-blue-400"
					>
						Edit response
					</button>
				</div>
			) : !showResponseForm ? (
				<button
					type="button"
					onClick={() => setShowResponseForm(true)}
					className="rounded-lg border border-border border-dashed px-4 py-3 text-muted-foreground text-sm transition-colors hover:border-foreground hover:text-foreground"
				>
					+ Add merchant response
				</button>
			) : null}

			{showResponseForm && (
				<div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
					<label className="block">
						<span className="mb-1 block font-medium text-foreground text-sm">
							Merchant Response
						</span>
						<textarea
							value={responseText}
							onChange={(e) => setResponseText(e.target.value)}
							rows={4}
							maxLength={5000}
							placeholder="Write your response to this review..."
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</label>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={actionLoading || !responseText.trim()}
							onClick={handleRespond}
							className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{actionLoading ? "Saving…" : "Save Response"}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowResponseForm(false);
								setResponseText("");
							}}
							className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			{deleteConfirm ? (
				<div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
					<p className="flex-1 text-red-700 text-sm dark:text-red-300">
						Are you sure you want to permanently delete this review?
					</p>
					<button
						type="button"
						disabled={actionLoading}
						onClick={() => {
							handleDelete();
						}}
						className="rounded-lg bg-red-600 px-4 py-2 font-medium text-sm text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
					>
						{actionLoading ? "Deleting…" : "Confirm Delete"}
					</button>
					<button
						type="button"
						onClick={() => setDeleteConfirm(false)}
						className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						Cancel
					</button>
				</div>
			) : (
				<div className="flex gap-2">
					{review.status !== "approved" && (
						<button
							type="button"
							disabled={actionLoading}
							onClick={() => {
								handleApprove();
							}}
							className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-sm text-white transition-opacity hover:bg-emerald-700 disabled:opacity-50"
						>
							{actionLoading ? "Approving…" : "Approve"}
						</button>
					)}
					{review.status !== "rejected" && (
						<button
							type="button"
							disabled={actionLoading}
							onClick={() => {
								handleReject();
							}}
							className="rounded-lg bg-red-600 px-4 py-2 font-medium text-sm text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
						>
							{actionLoading ? "Rejecting…" : "Reject"}
						</button>
					)}
					<button
						type="button"
						disabled={actionLoading}
						onClick={() => setDeleteConfirm(true)}
						className="rounded-lg border border-border px-4 py-2 font-medium text-destructive text-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
					>
						Delete
					</button>
				</div>
			)}
		</div>
	);

	return <ReviewModerationTemplate content={content} />;
}
