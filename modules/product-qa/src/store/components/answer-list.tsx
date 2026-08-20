"use client";

import { useCallback, useState } from "react";
import { useProductQaApi } from "./_hooks";
import { formatDate } from "./_utils";
import AnswerListTemplate from "./answer-list.mdx";

interface Answer {
	id: string;
	questionId: string;
	productId: string;
	customerId?: string | undefined;
	authorName: string;
	authorEmail: string;
	body: string;
	isOfficial: boolean;
	upvoteCount: number;
	status: string;
	createdAt: string;
}

interface AnswersResponse {
	answers: Answer[];
}

export function AnswerList({ questionId }: { questionId: string }) {
	const api = useProductQaApi();

	const { data, isLoading } = api.listAnswers.useQuery({
		params: { questionId },
	}) as { data: AnswersResponse | undefined; isLoading: boolean };

	const answers = data?.answers ?? [];

	const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
	const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>({});
	const [upvotingIds, setUpvotingIds] = useState<Set<string>>(new Set());

	const handleUpvote = useCallback(
		async (id: string) => {
			if (votedIds.has(id) || upvotingIds.has(id)) return;
			setUpvotingIds((prev) => new Set([...prev, id]));
			try {
				await api.upvoteAnswer.mutate({ params: { id } });
				setVotedIds((prev) => new Set([...prev, id]));
				setLocalUpvotes((prev) => ({
					...prev,
					[id]: (prev[id] ?? 0) + 1,
				}));
			} catch {
				// silently ignore
			} finally {
				setUpvotingIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			}
		},
		[api.upvoteAnswer, votedIds, upvotingIds],
	);

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[1, 2].map((n) => (
					<div key={n} className="space-y-1">
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
						<div className="h-3 w-full animate-pulse rounded bg-muted" />
					</div>
				))}
			</div>
		);
	}

	if (answers.length === 0) {
		return <p className="text-muted-foreground text-sm">No answers yet.</p>;
	}

	const answerCards = answers.map((answer) => {
		const voted = votedIds.has(answer.id);
		const upvotes = answer.upvoteCount + (localUpvotes[answer.id] ?? 0);
		const isUpvoting = upvotingIds.has(answer.id);

		const upvoteButton = (
			<button
				key={answer.id}
				type="button"
				disabled={voted || isUpvoting}
				onClick={() => void handleUpvote(answer.id)}
				className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors ${
					voted
						? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
						: "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
				} disabled:opacity-60`}
			>
				<span>{voted ? "+" : "^"}</span>
				<span>{upvotes}</span>
			</button>
		);

		return {
			answer,
			upvoteButton,
			formattedDate: formatDate(answer.createdAt),
		};
	});

	return <AnswerListTemplate answers={answerCards} />;
}
