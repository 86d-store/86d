"use client";

import { useProductQaApi } from "./_shared";

interface QaAnalytics {
	totalQuestions: number;
	pendingQuestions: number;
	publishedQuestions: number;
	rejectedQuestions: number;
	totalAnswers: number;
	pendingAnswers: number;
	publishedAnswers: number;
	officialAnswers: number;
	averageAnswersPerQuestion: number;
	unansweredCount: number;
}

export function QaAnalytics() {
	const api = useProductQaApi();
	const { data, isLoading } = api.analytics.useQuery({}) as {
		data: QaAnalytics | undefined;
		isLoading: boolean;
	};

	const responseRate =
		data && data.totalQuestions > 0
			? Math.round(
					((data.publishedQuestions - data.unansweredCount) /
						data.totalQuestions) *
						100,
				)
			: 0;

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">
					Q&amp;A Analytics
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Overview of product questions and response metrics
				</p>
			</div>

			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-24 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-5">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Questions
						</p>
						<p className="mt-2 font-bold text-3xl text-foreground">
							{data?.totalQuestions ?? 0}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-5">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Published
						</p>
						<p className="mt-2 font-bold text-3xl text-foreground">
							{data?.publishedQuestions ?? 0}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-5">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-2 font-bold text-3xl text-foreground">
							{data?.pendingQuestions ?? 0}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-5">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Response Rate
						</p>
						<p className="mt-2 font-bold text-3xl text-foreground">
							{responseRate}%
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
