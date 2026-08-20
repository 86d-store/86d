"use client";

import { useCallback, useState } from "react";
import { useProductQaApi } from "./_hooks";
import { formatDate } from "./_utils";
import ProductQASectionTemplate from "./product-qa-section.mdx";

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

interface AnswersResponse {
	answers: Answer[];
}

const PAGE_SIZE = 10;

export interface ProductQASectionProps {
	productId: string;
}

export function ProductQASection({ productId }: ProductQASectionProps) {
	const api = useProductQaApi();

	const {
		data: initialData,
		isLoading: loading,
		isError: queryError,
		refetch,
	} = api.listProductQuestions.useQuery({
		params: { productId },
		take: String(PAGE_SIZE),
		skip: "0",
	}) as {
		data: QuestionsResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: summaryData } = api.productQaSummary.useQuery({
		params: { productId },
	}) as { data: SummaryResponse | undefined };

	const [extraQuestions, setExtraQuestions] = useState<Question[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [skip, setSkip] = useState(0);
	const [loadedAll, setLoadedAll] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const [qName, setQName] = useState("");
	const [qEmail, setQEmail] = useState("");
	const [qBody, setQBody] = useState("");

	const allQuestions = [...(initialData?.questions ?? []), ...extraQuestions];
	const summary = summaryData?.summary ?? null;
	const hasMore =
		!loadedAll &&
		initialData !== undefined &&
		(initialData.questions.length === PAGE_SIZE || extraQuestions.length > 0);

	const submitMutation = api.submitQuestion.useMutation({
		onSuccess: () => {
			setShowForm(false);
			setQName("");
			setQEmail("");
			setQBody("");
			void api.listProductQuestions.invalidate();
			void api.productQaSummary.invalidate();
			setExtraQuestions([]);
			setSkip(0);
			setLoadedAll(false);
		},
	});

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

	const handleSubmitQuestion = (e: React.FormEvent) => {
		e.preventDefault();
		submitMutation.mutate({
			productId,
			authorName: qName,
			authorEmail: qEmail,
			body: qBody,
		});
	};

	if (loading) {
		return (
			<section id="questions" className="border-border/50 border-t py-10">
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

	if (queryError) {
		return (
			<section id="questions" className="border-border/50 border-t py-10">
				<h2 className="font-display font-semibold text-foreground text-lg tracking-tight">
					Questions & Answers
				</h2>
				<div
					className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center"
					role="alert"
				>
					<p className="font-medium text-destructive text-sm">
						Failed to load questions
					</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-2 font-medium text-destructive text-sm underline underline-offset-4"
					>
						Try again
					</button>
				</div>
			</section>
		);
	}

	const noQuestions = allQuestions.length === 0;
	const submitError = submitMutation.isError
		? "Failed to submit question."
		: "";

	const summaryDisplay =
		summary && summary.questionCount > 0 ? (
			<div className="mt-1 flex items-center gap-3">
				<span className="text-muted-foreground text-sm">
					{summary.questionCount} question
					{summary.questionCount !== 1 ? "s" : ""}
				</span>
				<span className="text-muted-foreground/40">|</span>
				<span className="text-muted-foreground text-sm">
					{summary.answeredCount} answered
				</span>
			</div>
		) : null;

	const toggleFormButton = (
		<button
			type="button"
			onClick={() => setShowForm((v) => !v)}
			className="rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
		>
			{showForm ? "Cancel" : "Ask a Question"}
		</button>
	);

	let formContent: React.ReactNode = null;
	if (showForm) {
		formContent = (
			<div className="mb-8">
				{submitMutation.isSuccess ? (
					<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
						<p className="font-semibold text-emerald-800 dark:text-emerald-200">
							Thank you for your question!
						</p>
						<p className="mt-1 text-emerald-700 text-sm dark:text-emerald-300">
							Your question will appear once approved.
						</p>
					</div>
				) : (
					<form
						onSubmit={handleSubmitQuestion}
						className="space-y-4 rounded-lg border border-border bg-muted/30 p-5"
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label
									htmlFor="pdp-qa-name"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									id="pdp-qa-name"
									type="text"
									required
									maxLength={200}
									value={qName}
									onChange={(e) => setQName(e.target.value)}
									placeholder="Your name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
								/>
							</div>
							<div>
								<label
									htmlFor="pdp-qa-email"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Email <span className="text-destructive">*</span>
								</label>
								<input
									id="pdp-qa-email"
									type="email"
									required
									value={qEmail}
									onChange={(e) => setQEmail(e.target.value)}
									placeholder="you@example.com"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="pdp-qa-body"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Your question <span className="text-destructive">*</span>
							</label>
							<textarea
								id="pdp-qa-body"
								required
								maxLength={5000}
								rows={4}
								value={qBody}
								onChange={(e) => setQBody(e.target.value)}
								placeholder="What would you like to know about this product?"
								className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
							/>
						</div>

						{submitError && (
							<p className="text-destructive text-sm" role="alert">
								{submitError}
							</p>
						)}

						<button
							type="submit"
							disabled={submitMutation.isPending}
							className="rounded-md bg-foreground px-5 py-2 font-medium text-background text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
						>
							{submitMutation.isPending ? "Submitting..." : "Submit Question"}
						</button>
					</form>
				)}
			</div>
		);
	}

	const emptyState =
		noQuestions && !showForm ? (
			<div className="rounded-lg border border-border bg-muted/30 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No questions yet</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Be the first to ask a question about this product.
				</p>
			</div>
		) : null;

	let questionsContent: React.ReactNode = null;
	if (!noQuestions) {
		questionsContent = (
			<div>
				{allQuestions.map((question) => (
					<QuestionRow key={question.id} question={question} />
				))}
				{hasMore && (
					<button
						type="button"
						onClick={() => void handleLoadMore()}
						disabled={loadingMore}
						className="mt-4 text-foreground text-sm underline-offset-4 hover:underline disabled:opacity-60"
					>
						{loadingMore ? "Loading..." : "Load more questions"}
					</button>
				)}
			</div>
		);
	}

	return (
		<ProductQASectionTemplate
			summaryDisplay={summaryDisplay}
			toggleFormButton={toggleFormButton}
			formContent={formContent}
			emptyState={emptyState}
			questionsContent={questionsContent}
		/>
	);
}

/* ── Question row with expandable answers ────────────────── */

function QuestionRow({ question }: { question: Question }) {
	const api = useProductQaApi();
	const [expanded, setExpanded] = useState(false);
	const [voted, setVoted] = useState(false);
	const [localUpvotes, setLocalUpvotes] = useState(question.upvoteCount);
	const [upvoting, setUpvoting] = useState(false);

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

	return (
		<article className="border-border border-b py-5 last:border-0">
			<div className="mb-2 flex items-start justify-between gap-3">
				<p className="flex-1 text-foreground text-sm leading-relaxed">
					{question.body}
				</p>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatDate(question.createdAt)}
				</span>
			</div>
			<div className="mt-2 flex items-center gap-3">
				<p className="text-muted-foreground text-xs">
					Asked by {question.authorName}
				</p>
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
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-foreground hover:text-foreground"
				>
					<span>
						{question.answerCount} answer
						{question.answerCount !== 1 ? "s" : ""}
					</span>
					<span className="text-[10px]">{expanded ? "\u25B2" : "\u25BC"}</span>
				</button>
			</div>
			{expanded && (
				<div className="mt-4 border-foreground/10 border-l-2 pl-4">
					<AnswersList
						questionId={question.id}
						inlineAnswers={question.answers}
					/>
				</div>
			)}
		</article>
	);
}

/* ── Answers list with upvoting ──────────────────────────── */

function AnswersList({
	questionId,
	inlineAnswers,
}: {
	questionId: string;
	inlineAnswers?: Answer[] | undefined;
}) {
	const api = useProductQaApi();

	const { data, isLoading } = api.listAnswers.useQuery(
		{ params: { questionId } },
		{ enabled: !inlineAnswers },
	) as { data: AnswersResponse | undefined; isLoading: boolean };

	const answers = inlineAnswers ?? data?.answers ?? [];

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

	if (!inlineAnswers && isLoading) {
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

	return (
		<div className="space-y-3">
			{answers.map((answer) => {
				const didVote = votedIds.has(answer.id);
				const upvotes = answer.upvoteCount + (localUpvotes[answer.id] ?? 0);
				const isUpvoting = upvotingIds.has(answer.id);

				return (
					<div
						key={answer.id}
						className={`rounded-lg border p-3 ${
							answer.isOfficial
								? "border-foreground/15 bg-foreground/[0.03]"
								: "border-border bg-background"
						}`}
					>
						<div className="mb-1 flex items-center gap-2">
							<span className="font-medium text-foreground text-xs">
								{answer.authorName}
							</span>
							{answer.isOfficial && (
								<span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-[10px] text-foreground/70">
									Official
								</span>
							)}
							<span className="text-muted-foreground text-xs">
								{formatDate(answer.createdAt)}
							</span>
						</div>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{answer.body}
						</p>
						<div className="mt-2">
							<button
								type="button"
								disabled={didVote || isUpvoting}
								onClick={() => void handleUpvote(answer.id)}
								className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors ${
									didVote
										? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
										: "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
								} disabled:opacity-60`}
							>
								<span>{didVote ? "+" : "^"}</span>
								<span>{upvotes}</span>
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
