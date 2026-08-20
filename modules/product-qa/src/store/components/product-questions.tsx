"use client";

import { useCallback, useState } from "react";
import { useProductQaApi } from "./_hooks";
import ProductQuestionsTemplate from "./product-questions.mdx";
import { QuestionCard } from "./question-card";
import { QuestionForm } from "./question-form";

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
	answers?: Answer[] | undefined;
}

interface QuestionsResponse {
	questions: Question[];
}

interface SummaryResponse {
	summary: {
		questionCount: number;
		answeredCount: number;
		unansweredCount: number;
	};
}

const PAGE_SIZE = 10;

export function ProductQuestions({
	productId,
	title = "Questions & Answers",
}: {
	productId: string;
	title?: string | undefined;
}) {
	const api = useProductQaApi();

	const { data: questionsData, isLoading: loadingQuestions } =
		api.listProductQuestions.useQuery({
			params: { productId },
			take: String(PAGE_SIZE),
			skip: "0",
		}) as { data: QuestionsResponse | undefined; isLoading: boolean };

	const { data: summaryData } = api.productQaSummary.useQuery({
		params: { productId },
	}) as { data: SummaryResponse | undefined; isLoading: boolean };

	const [extraQuestions, setExtraQuestions] = useState<Question[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [skip, setSkip] = useState(0);
	const [loadedAll, setLoadedAll] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const allQuestions = [...(questionsData?.questions ?? []), ...extraQuestions];
	const hasMore =
		!loadedAll &&
		questionsData !== undefined &&
		(questionsData.questions.length === PAGE_SIZE || extraQuestions.length > 0);

	const summary = summaryData?.summary;

	const handleLoadMore = useCallback(async () => {
		const nextSkip = skip === 0 ? PAGE_SIZE : skip + PAGE_SIZE;
		setLoadingMore(true);
		try {
			const fresh = (await api.listProductQuestions.fetch({
				params: { productId },
				take: String(PAGE_SIZE),
				skip: String(nextSkip),
			})) as QuestionsResponse;
			setExtraQuestions((prev) => [...prev, ...fresh.questions]);
			setSkip(nextSkip);
			if (fresh.questions.length < PAGE_SIZE) setLoadedAll(true);
		} catch {
			// silently ignore
		} finally {
			setLoadingMore(false);
		}
	}, [api.listProductQuestions, productId, skip]);

	const handleQuestionSubmitted = useCallback(() => {
		setShowForm(false);
		void api.listProductQuestions.invalidate();
		void api.productQaSummary.invalidate();
		setExtraQuestions([]);
		setSkip(0);
		setLoadedAll(false);
	}, [api.listProductQuestions, api.productQaSummary]);

	if (loadingQuestions) {
		return (
			<section className="py-8">
				<div className="mb-6 h-7 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-4">
					{[1, 2, 3].map((n) => (
						<div key={n} className="space-y-2 border-border border-b pb-4">
							<div className="h-4 w-32 animate-pulse rounded bg-muted" />
							<div className="h-4 w-full animate-pulse rounded bg-muted" />
							<div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</section>
		);
	}

	const noQuestions = allQuestions.length === 0;

	const questionListContent =
		allQuestions.length === 0 ? (
			<p className="text-muted-foreground text-sm">
				No questions yet. Be the first to ask!
			</p>
		) : (
			<div>
				{allQuestions.map((question) => (
					<QuestionCard key={question.id} question={question} />
				))}
				{hasMore && (
					<button
						type="button"
						onClick={() => void handleLoadMore()}
						disabled={loadingMore}
						className="mt-4 text-primary text-sm underline-offset-4 hover:underline disabled:opacity-60"
					>
						{loadingMore ? "Loading..." : "Load more questions"}
					</button>
				)}
			</div>
		);

	return (
		<ProductQuestionsTemplate
			title={title}
			summary={summary}
			noQuestions={noQuestions}
			showForm={showForm}
			onToggleForm={() => setShowForm((v) => !v)}
			formContent={
				<QuestionForm
					productId={productId}
					onSuccess={handleQuestionSubmitted}
				/>
			}
			questionListContent={questionListContent}
		/>
	);
}
