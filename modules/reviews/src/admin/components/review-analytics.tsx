"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import ReviewAnalyticsTemplate from "./review-analytics.mdx";

interface ReviewAnalyticsData {
	totalReviews: number;
	pendingCount: number;
	approvedCount: number;
	rejectedCount: number;
	averageRating: number;
	ratingsDistribution: Record<string, number>;
	withMerchantResponse: number;
}

function useReviewsAdminApi() {
	const client = useModuleClient();
	return {
		analytics: client.module("reviews").admin["/admin/reviews/analytics"],
	};
}

function StarDisplay({ rating }: { rating: number }) {
	return (
		<span
			role="img"
			className="select-none text-lg leading-none"
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

function StatCard({
	label,
	value,
	className,
}: {
	label: string;
	value: string | number;
	className?: string;
}) {
	return (
		<div
			className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}
		>
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-semibold text-2xl text-foreground">{value}</p>
		</div>
	);
}

function DistributionBar({
	star,
	count,
	total,
}: {
	star: number;
	count: number;
	total: number;
}) {
	const pct = total > 0 ? Math.round((count / total) * 100) : 0;
	return (
		<div className="flex items-center gap-3">
			<span className="w-8 text-right text-muted-foreground text-sm">
				{star}★
			</span>
			<div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-amber-400 transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="w-10 text-right text-muted-foreground text-xs">
				{count}
			</span>
		</div>
	);
}

export function ReviewAnalytics() {
	const api = useReviewsAdminApi();

	const {
		data,
		isLoading: loading,
		isError: analyticsError,
		refetch: refetchAnalytics,
	} = api.analytics.useQuery({}) as {
		data: { analytics: ReviewAnalyticsData } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (analyticsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load review analytics
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAnalytics()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">Loading analytics...</p>
			</div>
		);
	}

	const analytics = data?.analytics;

	if (!analytics) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">
					No analytics data available.
				</p>
			</div>
		);
	}

	const responseRate =
		analytics.totalReviews > 0
			? Math.round(
					(analytics.withMerchantResponse / analytics.totalReviews) * 100,
				)
			: 0;

	const content = (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-foreground text-lg">
					Review Analytics
				</h2>
				<p className="text-muted-foreground text-sm">
					Overview of customer reviews and ratings
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Total Reviews" value={analytics.totalReviews} />
				<StatCard label="Average Rating" value={analytics.averageRating} />
				<StatCard label="Pending" value={analytics.pendingCount} />
				<StatCard label="Response Rate" value={`${responseRate}%`} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Rating Distribution
					</h3>
					<div className="mb-3 flex items-center gap-2">
						<StarDisplay rating={analytics.averageRating} />
						<span className="font-semibold text-foreground text-xl">
							{analytics.averageRating}
						</span>
						<span className="text-muted-foreground text-sm">out of 5</span>
					</div>
					<div className="space-y-2">
						{[5, 4, 3, 2, 1].map((star) => (
							<DistributionBar
								key={star}
								star={star}
								count={analytics.ratingsDistribution[String(star)] ?? 0}
								total={analytics.totalReviews}
							/>
						))}
					</div>
				</div>

				<div className="rounded-xl border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Status Breakdown
					</h3>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
								<span className="text-foreground text-sm">Approved</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.approvedCount}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
								<span className="text-foreground text-sm">Pending</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.pendingCount}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-full bg-red-500" />
								<span className="text-foreground text-sm">Rejected</span>
							</div>
							<span className="font-medium text-foreground text-sm">
								{analytics.rejectedCount}
							</span>
						</div>
						<div className="mt-4 border-border border-t pt-4">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									With merchant response
								</span>
								<span className="font-medium text-foreground text-sm">
									{analytics.withMerchantResponse}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);

	return <ReviewAnalyticsTemplate content={content} />;
}
