import type { ModuleController } from "@86d-app/core/types/module";

export type QuestionStatus = "pending" | "published" | "rejected";
export type AnswerStatus = "pending" | "published" | "rejected";

export type Question = {
	id: string;
	productId: string;
	customerId?: string | undefined;
	authorName: string;
	authorEmail: string;
	body: string;
	status: QuestionStatus;
	upvoteCount: number;
	answerCount: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Answer = {
	id: string;
	questionId: string;
	productId: string;
	customerId?: string | undefined;
	authorName: string;
	authorEmail: string;
	body: string;
	isOfficial: boolean;
	upvoteCount: number;
	status: AnswerStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type QaAnalytics = {
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
};

export type ProductQaSummary = {
	questionCount: number;
	answeredCount: number;
	unansweredCount: number;
};

export type ProductQaController = ModuleController & {
	// ── Questions ────────────────────────────────────────────────────────

	createQuestion(params: {
		productId: string;
		authorName: string;
		authorEmail: string;
		body: string;
		customerId?: string | undefined;
	}): Promise<Question>;

	getQuestion(id: string): Promise<Question | null>;

	listQuestionsByProduct(
		productId: string,
		params?: {
			publishedOnly?: boolean | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Question[]>;

	listQuestions(params?: {
		productId?: string | undefined;
		status?: QuestionStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Question[]>;

	updateQuestionStatus(
		id: string,
		status: QuestionStatus,
	): Promise<Question | null>;

	deleteQuestion(id: string): Promise<boolean>;

	upvoteQuestion(id: string): Promise<Question | null>;

	// ── Answers ──────────────────────────────────────────────────────────

	createAnswer(params: {
		questionId: string;
		productId: string;
		authorName: string;
		authorEmail: string;
		body: string;
		customerId?: string | undefined;
		isOfficial?: boolean | undefined;
	}): Promise<Answer>;

	getAnswer(id: string): Promise<Answer | null>;

	listAnswersByQuestion(
		questionId: string,
		params?: {
			publishedOnly?: boolean | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Answer[]>;

	updateAnswerStatus(id: string, status: AnswerStatus): Promise<Answer | null>;

	deleteAnswer(id: string): Promise<boolean>;

	upvoteAnswer(id: string): Promise<Answer | null>;

	// ── Analytics ────────────────────────────────────────────────────────

	getProductQaSummary(productId: string): Promise<ProductQaSummary>;

	getQaAnalytics(): Promise<QaAnalytics>;
};
