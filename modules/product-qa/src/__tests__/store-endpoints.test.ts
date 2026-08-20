import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Answer, Question } from "../service";
import { createProductQaController } from "../service-impl";

/**
 * Store endpoint integration tests for the product-qa module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-questions: published only, by product, with pagination
 * 2. ask-question: creates a pending question (needs moderation)
 * 3. list-answers: published only, by question
 * 4. submit-answer: creates a pending answer
 * 5. upvote-question: increments upvote count
 * 6. upvote-answer: increments upvote count
 * 7. get-product-summary: question/answer counts for a product
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListQuestions(
	data: DataService,
	productId: string,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createProductQaController(data);
	const questions = await controller.listQuestionsByProduct(productId, {
		publishedOnly: true,
		take: query.take ?? 20,
		skip: query.skip ?? 0,
	});
	return { questions };
}

async function simulateAskQuestion(
	data: DataService,
	body: {
		productId: string;
		authorName: string;
		authorEmail: string;
		body: string;
		customerId?: string;
	},
) {
	const controller = createProductQaController(data);
	const question = await controller.createQuestion(body);
	return { question };
}

async function simulateListAnswers(
	data: DataService,
	questionId: string,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createProductQaController(data);
	const answers = await controller.listAnswersByQuestion(questionId, {
		publishedOnly: true,
		take: query.take ?? 20,
		skip: query.skip ?? 0,
	});
	return { answers };
}

async function simulateSubmitAnswer(
	data: DataService,
	body: {
		questionId: string;
		productId: string;
		authorName: string;
		authorEmail: string;
		body: string;
		customerId?: string;
	},
) {
	const controller = createProductQaController(data);
	const answer = await controller.createAnswer(body);
	return { answer };
}

async function simulateUpvoteQuestion(data: DataService, questionId: string) {
	const controller = createProductQaController(data);
	const question = await controller.upvoteQuestion(questionId);
	if (!question) return { error: "Question not found", status: 404 };
	return { question };
}

async function simulateUpvoteAnswer(data: DataService, answerId: string) {
	const controller = createProductQaController(data);
	const answer = await controller.upvoteAnswer(answerId);
	if (!answer) return { error: "Answer not found", status: 404 };
	return { answer };
}

async function simulateGetProductSummary(data: DataService, productId: string) {
	const controller = createProductQaController(data);
	const summary = await controller.getProductQaSummary(productId);
	return { summary };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list questions — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published questions for a product", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Does this come in blue?",
		});
		await ctrl.updateQuestionStatus(q.id, "published");

		await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Bob",
			authorEmail: "bob@example.com",
			body: "Pending question",
		});

		const result = await simulateListQuestions(data, "prod_1");

		expect(result.questions).toHaveLength(1);
		expect((result.questions[0] as Question).body).toBe(
			"Does this come in blue?",
		);
	});

	it("returns empty for product with no published questions", async () => {
		const result = await simulateListQuestions(data, "prod_empty");

		expect(result.questions).toHaveLength(0);
	});

	it("paginates results", async () => {
		const ctrl = createProductQaController(data);
		for (let i = 0; i < 5; i++) {
			const q = await ctrl.createQuestion({
				productId: "prod_1",
				authorName: `User ${i}`,
				authorEmail: `user${i}@example.com`,
				body: `Question ${i}`,
			});
			await ctrl.updateQuestionStatus(q.id, "published");
		}

		const page1 = await simulateListQuestions(data, "prod_1", { take: 2 });
		const page2 = await simulateListQuestions(data, "prod_1", {
			take: 2,
			skip: 2,
		});

		expect(page1.questions).toHaveLength(2);
		expect(page2.questions).toHaveLength(2);
	});

	it("does not return questions from other products", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_other",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Other product question",
		});
		await ctrl.updateQuestionStatus(q.id, "published");

		const result = await simulateListQuestions(data, "prod_1");

		expect(result.questions).toHaveLength(0);
	});
});

describe("store endpoint: ask question — creates pending", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a question with pending status", async () => {
		const result = await simulateAskQuestion(data, {
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Is this machine washable?",
		});

		expect(result.question.status).toBe("pending");
		expect(result.question.body).toBe("Is this machine washable?");
		expect(result.question.productId).toBe("prod_1");
	});

	it("associates question with customer when authenticated", async () => {
		const result = await simulateAskQuestion(data, {
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "How long does shipping take?",
			customerId: "cust_1",
		});

		expect(result.question.customerId).toBe("cust_1");
	});
});

describe("store endpoint: list answers — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published answers for a question", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Question?",
		});
		const a = await ctrl.createAnswer({
			questionId: q.id,
			productId: "prod_1",
			authorName: "Store",
			authorEmail: "support@store.com",
			body: "Yes, it does!",
			isOfficial: true,
		});
		await ctrl.updateAnswerStatus(a.id, "published");

		await ctrl.createAnswer({
			questionId: q.id,
			productId: "prod_1",
			authorName: "Spammer",
			authorEmail: "spam@example.com",
			body: "Buy my stuff",
		});

		const result = await simulateListAnswers(data, q.id);

		expect(result.answers).toHaveLength(1);
		expect((result.answers[0] as Answer).isOfficial).toBe(true);
	});

	it("returns empty for question with no published answers", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Unanswered question",
		});

		const result = await simulateListAnswers(data, q.id);

		expect(result.answers).toHaveLength(0);
	});
});

describe("store endpoint: submit answer — creates pending", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates an answer with pending status", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Question?",
		});

		const result = await simulateSubmitAnswer(data, {
			questionId: q.id,
			productId: "prod_1",
			authorName: "Bob",
			authorEmail: "bob@example.com",
			body: "I think so!",
		});

		expect(result.answer.status).toBe("pending");
		expect(result.answer.body).toBe("I think so!");
	});
});

describe("store endpoint: upvote question", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("increments upvote count", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Great question",
		});
		expect(q.upvoteCount).toBe(0);

		const result = await simulateUpvoteQuestion(data, q.id);

		expect("question" in result).toBe(true);
		if ("question" in result) {
			expect(result.question.upvoteCount).toBe(1);
		}
	});

	it("accumulates votes", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Popular question",
		});

		await simulateUpvoteQuestion(data, q.id);
		await simulateUpvoteQuestion(data, q.id);
		const result = await simulateUpvoteQuestion(data, q.id);

		expect("question" in result).toBe(true);
		if ("question" in result) {
			expect(result.question.upvoteCount).toBe(3);
		}
	});

	it("returns 404 for nonexistent question", async () => {
		const result = await simulateUpvoteQuestion(data, "ghost_id");

		expect(result).toEqual({ error: "Question not found", status: 404 });
	});
});

describe("store endpoint: upvote answer", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("increments upvote count on answer", async () => {
		const ctrl = createProductQaController(data);
		const q = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Question?",
		});
		const a = await ctrl.createAnswer({
			questionId: q.id,
			productId: "prod_1",
			authorName: "Bob",
			authorEmail: "bob@example.com",
			body: "Helpful answer",
		});

		const result = await simulateUpvoteAnswer(data, a.id);

		expect("answer" in result).toBe(true);
		if ("answer" in result) {
			expect(result.answer.upvoteCount).toBe(1);
		}
	});

	it("returns 404 for nonexistent answer", async () => {
		const result = await simulateUpvoteAnswer(data, "ghost_id");

		expect(result).toEqual({ error: "Answer not found", status: 404 });
	});
});

describe("store endpoint: product Q&A summary", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns summary for product with questions", async () => {
		const ctrl = createProductQaController(data);
		const q1 = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Alice",
			authorEmail: "alice@example.com",
			body: "Question 1",
		});
		await ctrl.updateQuestionStatus(q1.id, "published");

		const a = await ctrl.createAnswer({
			questionId: q1.id,
			productId: "prod_1",
			authorName: "Store",
			authorEmail: "support@store.com",
			body: "Answer",
		});
		await ctrl.updateAnswerStatus(a.id, "published");

		const q2 = await ctrl.createQuestion({
			productId: "prod_1",
			authorName: "Bob",
			authorEmail: "bob@example.com",
			body: "Question 2 (unanswered)",
		});
		await ctrl.updateQuestionStatus(q2.id, "published");

		const result = await simulateGetProductSummary(data, "prod_1");

		expect(result.summary.questionCount).toBe(2);
		expect(result.summary.answeredCount).toBeGreaterThanOrEqual(1);
	});

	it("returns zeros for product with no questions", async () => {
		const result = await simulateGetProductSummary(data, "prod_empty");

		expect(result.summary.questionCount).toBe(0);
		expect(result.summary.answeredCount).toBe(0);
		expect(result.summary.unansweredCount).toBe(0);
	});
});
