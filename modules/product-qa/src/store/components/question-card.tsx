"use client";

import { useCallback, useState } from "react";
import { useProductQaApi } from "./_hooks";
import { formatDate } from "./_utils";
import { AnswerList } from "./answer-list";
import QuestionCardTemplate from "./question-card.mdx";

interface Question {
	id: string;
	productId: string;
	customerId?: string | undefined;
	authorName: string;
	authorEmail: string;
	body: string;
	status: string;
	upvoteCount: number;
	answerCount: number;
	createdAt: string;
}

export function QuestionCard({ question }: { question: Question }) {
	const api = useProductQaApi();
	const [voted, setVoted] = useState(false);
	const [localUpvotes, setLocalUpvotes] = useState(question.upvoteCount);
	const [upvoting, setUpvoting] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const handleUpvote = useCallback(async () => {
		if (voted || upvoting) return;
		setUpvoting(true);
		try {
			await api.upvoteQuestion.mutate({ params: { id: question.id } });
			setVoted(true);
			setLocalUpvotes((c) => c + 1);
		} catch {
			// silently ignore
		} finally {
			setUpvoting(false);
		}
	}, [api.upvoteQuestion, question.id, voted, upvoting]);

	const upvoteButton = (
		<button
			type="button"
			disabled={voted || upvoting}
			onClick={() => void handleUpvote()}
			aria-label={voted ? "Upvoted" : "Upvote this question"}
			aria-pressed={voted}
			className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
				voted
					? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
					: "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
			} disabled:opacity-60`}
		>
			<span aria-hidden="true">{voted ? "+" : "^"}</span>
			<span>{localUpvotes}</span>
		</button>
	);

	const expandButton = (
		<button
			type="button"
			onClick={() => setExpanded((v) => !v)}
			className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-foreground hover:text-foreground"
		>
			<span>
				{question.answerCount} answer
				{question.answerCount !== 1 ? "s" : ""}
			</span>
			<span className="text-[10px]">{expanded ? "▲" : "▼"}</span>
		</button>
	);

	const answerListContent = expanded ? (
		<div className="mt-4 border-primary/20 border-l-2 pl-4">
			<AnswerList questionId={question.id} />
		</div>
	) : null;

	return (
		<QuestionCardTemplate
			question={question}
			formatDate={formatDate}
			upvoteButton={upvoteButton}
			expandButton={expandButton}
			answerListContent={answerListContent}
		/>
	);
}
