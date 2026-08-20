import { describe, expect, it, vi } from "vitest";
import { deleteAnswer } from "../admin/endpoints/delete-answer";
import { deleteQuestion } from "../admin/endpoints/delete-question";
import { getQuestion } from "../admin/endpoints/get-question";
import { listQuestions } from "../admin/endpoints/list-questions";
import { postOfficialAnswer } from "../admin/endpoints/post-official-answer";
import { publishAnswer } from "../admin/endpoints/publish-answer";
import { publishQuestion } from "../admin/endpoints/publish-question";
import { qaAnalytics } from "../admin/endpoints/qa-analytics";
import { rejectAnswer } from "../admin/endpoints/reject-answer";
import { rejectQuestion } from "../admin/endpoints/reject-question";
import type {
	Answer,
	AnswerStatus,
	ProductQaController,
	QaAnalytics,
	Question,
	QuestionStatus,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		authorName: "Alice",
		authorEmail: "alice@example.com",
		body: "Does this come in blue?",
		status: "pending" as QuestionStatus,
		upvoteCount: 0,
		answerCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeAnswer(overrides: Partial<Answer> = {}): Answer {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		questionId: "q_1",
		productId: "prod_1",
		authorName: "Support",
		authorEmail: "support@store.com",
		body: "Yes, it comes in blue!",
		isOfficial: false,
		upvoteCount: 0,
		status: "pending" as AnswerStatus,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<ProductQaController> = {},
): ProductQaController {
	return {
		createQuestion: vi.fn().mockResolvedValue(makeQuestion()),
		getQuestion: vi.fn().mockResolvedValue(null),
		listQuestionsByProduct: vi.fn().mockResolvedValue([]),
		listQuestions: vi.fn().mockResolvedValue([]),
		updateQuestionStatus: vi.fn().mockResolvedValue(null),
		deleteQuestion: vi.fn().mockResolvedValue(false),
		upvoteQuestion: vi.fn().mockResolvedValue(null),
		createAnswer: vi.fn().mockResolvedValue(makeAnswer()),
		getAnswer: vi.fn().mockResolvedValue(null),
		listAnswersByQuestion: vi.fn().mockResolvedValue([]),
		updateAnswerStatus: vi.fn().mockResolvedValue(null),
		deleteAnswer: vi.fn().mockResolvedValue(false),
		upvoteAnswer: vi.fn().mockResolvedValue(null),
		getProductQaSummary: vi.fn().mockResolvedValue({
			questionCount: 0,
			answeredCount: 0,
			unansweredCount: 0,
		}),
		getQaAnalytics: vi.fn().mockResolvedValue({
			totalQuestions: 0,
			pendingQuestions: 0,
			publishedQuestions: 0,
			rejectedQuestions: 0,
			totalAnswers: 0,
			pendingAnswers: 0,
			publishedAnswers: 0,
			officialAnswers: 0,
			averageAnswersPerQuestion: 0,
			unansweredCount: 0,
		} satisfies QaAnalytics),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ProductQaController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { productQa: opts.controller ?? makeController() },
		},
	});
}

const listQuestionsHandler = extractHandler(listQuestions);
const analyticsHandler = extractHandler(qaAnalytics);
const getQuestionHandler = extractHandler(getQuestion);
const publishQuestionHandler = extractHandler(publishQuestion);
const rejectQuestionHandler = extractHandler(rejectQuestion);
const officialAnswerHandler = extractHandler(postOfficialAnswer);
const deleteQuestionHandler = extractHandler(deleteQuestion);
const publishAnswerHandler = extractHandler(publishAnswer);
const rejectAnswerHandler = extractHandler(rejectAnswer);
const deleteAnswerHandler = extractHandler(deleteAnswer);

describe("admin GET /product-qa/questions", () => {
	it("returns empty list", async () => {
		const result = (await call(listQuestionsHandler)) as {
			questions: Question[];
		};
		expect(result.questions).toHaveLength(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listQuestionsHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listQuestions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

describe("admin GET /product-qa/analytics", () => {
	it("returns zero-state analytics", async () => {
		const result = (await call(analyticsHandler)) as {
			analytics: QaAnalytics;
		};
		expect(result.analytics.totalQuestions).toBe(0);
	});

	it("returns real analytics", async () => {
		const ctrl = makeController({
			getQaAnalytics: vi.fn().mockResolvedValue({
				totalQuestions: 50,
				pendingQuestions: 5,
				publishedQuestions: 40,
				rejectedQuestions: 5,
				totalAnswers: 80,
				pendingAnswers: 3,
				publishedAnswers: 75,
				officialAnswers: 20,
				averageAnswersPerQuestion: 1.6,
				unansweredCount: 10,
			}),
		});
		const result = (await call(analyticsHandler, { controller: ctrl })) as {
			analytics: QaAnalytics;
		};
		expect(result.analytics.totalQuestions).toBe(50);
		expect(result.analytics.officialAnswers).toBe(20);
	});
});

describe("admin GET /product-qa/questions/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getQuestionHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Question not found");
	});

	it("returns question and answers when found", async () => {
		const question = makeQuestion({ id: "q_1" });
		const answers = [makeAnswer({ questionId: "q_1" })];
		const ctrl = makeController({
			getQuestion: vi.fn().mockResolvedValue(question),
			listAnswersByQuestion: vi.fn().mockResolvedValue(answers),
		});
		const result = (await call(getQuestionHandler, {
			params: { id: "q_1" },
			controller: ctrl,
		})) as { question: Question; answers: Answer[] };
		expect(result.question.id).toBe("q_1");
		expect(result.answers).toHaveLength(1);
	});
});

describe("admin POST /product-qa/questions/:id/publish", () => {
	it("returns error when not found", async () => {
		const result = (await call(publishQuestionHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Question not found");
	});

	it("publishes the question", async () => {
		const question = makeQuestion({ status: "published" });
		const ctrl = makeController({
			updateQuestionStatus: vi.fn().mockResolvedValue(question),
		});
		const result = (await call(publishQuestionHandler, {
			params: { id: question.id },
			controller: ctrl,
		})) as { question: Question };
		expect(result.question.status).toBe("published");
		expect(ctrl.updateQuestionStatus).toHaveBeenCalledWith(
			question.id,
			"published",
		);
	});
});

describe("admin POST /product-qa/questions/:id/reject", () => {
	it("returns error when not found", async () => {
		const result = (await call(rejectQuestionHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Question not found");
	});

	it("rejects the question", async () => {
		const question = makeQuestion({ status: "rejected" });
		const ctrl = makeController({
			updateQuestionStatus: vi.fn().mockResolvedValue(question),
		});
		const result = (await call(rejectQuestionHandler, {
			params: { id: question.id },
			controller: ctrl,
		})) as { question: Question };
		expect(result.question.status).toBe("rejected");
		expect(ctrl.updateQuestionStatus).toHaveBeenCalledWith(
			question.id,
			"rejected",
		);
	});
});

describe("admin POST /product-qa/questions/:id/answer", () => {
	it("returns error when question not found", async () => {
		const result = (await call(officialAnswerHandler, {
			params: { id: "missing" },
			body: { body: "Yes!", authorName: "Support", authorEmail: "s@store.com" },
		})) as { error: string };
		expect(result.error).toBe("Question not found");
	});

	it("posts an official answer", async () => {
		const question = makeQuestion({ id: "q_1" });
		const answer = makeAnswer({ isOfficial: true, questionId: "q_1" });
		const ctrl = makeController({
			getQuestion: vi.fn().mockResolvedValue(question),
			createAnswer: vi.fn().mockResolvedValue(answer),
		});
		const result = (await call(officialAnswerHandler, {
			params: { id: "q_1" },
			body: {
				body: "Yes, it does!",
				authorName: "Support",
				authorEmail: "support@store.com",
			},
			controller: ctrl,
		})) as { answer: Answer };
		expect(result.answer.isOfficial).toBe(true);
	});
});

describe("admin POST /product-qa/questions/:id/delete", () => {
	it("returns error when not found", async () => {
		const result = (await call(deleteQuestionHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Question not found");
	});

	it("deletes the question", async () => {
		const ctrl = makeController({
			deleteQuestion: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteQuestionHandler, {
			params: { id: "q_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /product-qa/answers/:id/publish", () => {
	it("returns error when not found", async () => {
		const result = (await call(publishAnswerHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Answer not found");
	});

	it("publishes the answer", async () => {
		const answer = makeAnswer({ status: "published" });
		const ctrl = makeController({
			updateAnswerStatus: vi.fn().mockResolvedValue(answer),
		});
		const result = (await call(publishAnswerHandler, {
			params: { id: answer.id },
			controller: ctrl,
		})) as { answer: Answer };
		expect(result.answer.status).toBe("published");
		expect(ctrl.updateAnswerStatus).toHaveBeenCalledWith(
			answer.id,
			"published",
		);
	});
});

describe("admin POST /product-qa/answers/:id/reject", () => {
	it("returns error when not found", async () => {
		const result = (await call(rejectAnswerHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Answer not found");
	});

	it("rejects the answer", async () => {
		const answer = makeAnswer({ status: "rejected" });
		const ctrl = makeController({
			updateAnswerStatus: vi.fn().mockResolvedValue(answer),
		});
		const result = (await call(rejectAnswerHandler, {
			params: { id: answer.id },
			controller: ctrl,
		})) as { answer: Answer };
		expect(result.answer.status).toBe("rejected");
		expect(ctrl.updateAnswerStatus).toHaveBeenCalledWith(answer.id, "rejected");
	});
});

describe("admin POST /product-qa/answers/:id/delete", () => {
	it("returns error when not found", async () => {
		const result = (await call(deleteAnswerHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Answer not found");
	});

	it("deletes the answer", async () => {
		const ctrl = makeController({
			deleteAnswer: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteAnswerHandler, {
			params: { id: "ans_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});
