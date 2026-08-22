"use client";

import { useState } from "react";
import { type Question, STATUS_COLORS, useProductQaApi } from "./_shared";

export function QuestionList() {
	const api = useProductQaApi();
	const [statusFilter, setStatusFilter] = useState<string>("");

	const {
		data,
		isLoading,
		isError: questionsError,
		refetch: refetchQuestions,
	} = api.list.useQuery(statusFilter ? { status: statusFilter } : {}) as {
		data: { questions?: Question[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (questionsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load questions
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchQuestions()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const questions = data?.questions ?? [];

	const tabs = [
		{ value: "", label: "All" },
		{ value: "pending", label: "Pending" },
		{ value: "published", label: "Published" },
		{ value: "rejected", label: "Rejected" },
	];

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Product Q&amp;A
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage customer questions and answers on products
					</p>
				</div>
			</div>

			<div className="mb-4 flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
				{tabs.map((tab) => (
					<button
						key={tab.value}
						type="button"
						onClick={() => setStatusFilter(tab.value)}
						className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
							statusFilter === tab.value
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : questions.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						{statusFilter
							? `No ${statusFilter} questions.`
							: "No questions yet. Questions will appear here when customers ask about your products."}
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{questions.map((q) => (
						<a
							key={q.id}
							href={`/admin/product-qa/${q.id}`}
							className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<p className="font-medium text-foreground text-sm">
										{q.body}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Asked by {q.authorName || q.authorEmail}
										{q.answerCount > 0
											? ` \u00b7 ${q.answerCount} answer${q.answerCount !== 1 ? "s" : ""}`
											: ""}
										{q.upvoteCount > 0
											? ` \u00b7 ${q.upvoteCount} upvote${q.upvoteCount !== 1 ? "s" : ""}`
											: ""}
									</p>
								</div>
								<span
									className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[q.status] ?? "bg-muted text-muted-foreground"}`}
								>
									{q.status}
								</span>
							</div>
						</a>
					))}
				</div>
			)}
		</div>
	);
}
