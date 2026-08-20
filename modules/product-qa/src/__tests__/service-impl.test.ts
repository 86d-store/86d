import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import productQaModule from "../index";
import type { ProductQaController } from "../service";
import { createProductQaController } from "../service-impl";

// ── Helper ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Record<string, unknown> = {}) {
	return {
		productId: "prod_1",
		authorName: "Alice",
		authorEmail: "alice@test.com",
		body: "Does this come in blue?",
		...overrides,
	} as Parameters<
		ReturnType<typeof createProductQaController>["createQuestion"]
	>[0];
}

function makeAnswer(
	questionId: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		questionId,
		productId: "prod_1",
		authorName: "Bob",
		authorEmail: "bob@test.com",
		body: "Yes, it comes in blue and red.",
		...overrides,
	} as Parameters<
		ReturnType<typeof createProductQaController>["createAnswer"]
	>[0];
}

// ── Controller ──────────────────────────────────────────────────────────────

describe("createProductQaController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createProductQaController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductQaController(mockData);
	});

	// ── createQuestion ──────────────────────────────────────────────────

	describe("createQuestion", () => {
		it("creates a question with pending status by default", async () => {
			const question = await controller.createQuestion(makeQuestion());
			expect(question.id).toBeDefined();
			expect(question.productId).toBe("prod_1");
			expect(question.authorName).toBe("Alice");
			expect(question.body).toBe("Does this come in blue?");
			expect(question.status).toBe("pending");
			expect(question.upvoteCount).toBe(0);
			expect(question.answerCount).toBe(0);
		});

		it("creates a question with published status when autoPublish is true", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const question = await autoController.createQuestion(makeQuestion());
			expect(question.status).toBe("published");
		});

		it("assigns a unique id and timestamps", async () => {
			const q1 = await controller.createQuestion(makeQuestion());
			const q2 = await controller.createQuestion(
				makeQuestion({ body: "Another question?" }),
			);
			expect(q1.id).not.toBe(q2.id);
			expect(q1.createdAt).toBeInstanceOf(Date);
			expect(q1.updatedAt).toBeInstanceOf(Date);
		});

		it("preserves optional customerId", async () => {
			const question = await controller.createQuestion(
				makeQuestion({ customerId: "cust_1" }),
			);
			expect(question.customerId).toBe("cust_1");
		});

		it("creates question without customerId", async () => {
			const question = await controller.createQuestion(makeQuestion());
			expect(question.customerId).toBeUndefined();
		});
	});

	// ── getQuestion ─────────────────────────────────────────────────────

	describe("getQuestion", () => {
		it("returns a question by id", async () => {
			const created = await controller.createQuestion(makeQuestion());
			const found = await controller.getQuestion(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.body).toBe("Does this come in blue?");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getQuestion("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── listQuestionsByProduct ──────────────────────────────────────────

	describe("listQuestionsByProduct", () => {
		it("lists questions for a product", async () => {
			await controller.createQuestion(makeQuestion());
			await controller.createQuestion(
				makeQuestion({ productId: "prod_2", body: "Different product?" }),
			);
			const questions = await controller.listQuestionsByProduct("prod_1");
			expect(questions).toHaveLength(1);
			expect(questions[0].productId).toBe("prod_1");
		});

		it("filters by published status when publishedOnly is true", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.updateQuestionStatus(q.id, "published");
			await controller.createQuestion(makeQuestion({ body: "Still pending?" }));

			const published = await controller.listQuestionsByProduct("prod_1", {
				publishedOnly: true,
			});
			expect(published).toHaveLength(1);
			expect(published[0].status).toBe("published");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createQuestion(
					makeQuestion({ body: `Question ${i}` }),
				);
			}
			const page = await controller.listQuestionsByProduct("prod_1", {
				take: 2,
				skip: 1,
			});
			expect(page.length).toBeLessThanOrEqual(2);
		});
	});

	// ── listQuestions ───────────────────────────────────────────────────

	describe("listQuestions", () => {
		it("lists all questions when no filters", async () => {
			await controller.createQuestion(makeQuestion());
			await controller.createQuestion(
				makeQuestion({ productId: "prod_2", body: "Other?" }),
			);
			const all = await controller.listQuestions();
			expect(all).toHaveLength(2);
		});

		it("filters by productId", async () => {
			await controller.createQuestion(makeQuestion());
			await controller.createQuestion(
				makeQuestion({ productId: "prod_2", body: "Other?" }),
			);
			const filtered = await controller.listQuestions({
				productId: "prod_1",
			});
			expect(filtered).toHaveLength(1);
		});

		it("filters by status", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.updateQuestionStatus(q.id, "published");
			await controller.createQuestion(makeQuestion({ body: "Still pending?" }));
			const published = await controller.listQuestions({
				status: "published",
			});
			expect(published).toHaveLength(1);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createQuestion(
					makeQuestion({ body: `Question ${i}` }),
				);
			}
			const page = await controller.listQuestions({ take: 3 });
			expect(page.length).toBeLessThanOrEqual(3);
		});
	});

	// ── updateQuestionStatus ────────────────────────────────────────────

	describe("updateQuestionStatus", () => {
		it("publishes a pending question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const updated = await controller.updateQuestionStatus(q.id, "published");
			expect(updated).not.toBeNull();
			expect(updated?.status).toBe("published");
		});

		it("rejects a question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const updated = await controller.updateQuestionStatus(q.id, "rejected");
			expect(updated?.status).toBe("rejected");
		});

		it("returns null for non-existent question", async () => {
			const result = await controller.updateQuestionStatus(
				"nonexistent",
				"published",
			);
			expect(result).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const originalUpdatedAt = q.updatedAt;
			const updated = await controller.updateQuestionStatus(q.id, "published");
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});
	});

	// ── deleteQuestion ──────────────────────────────────────────────────

	describe("deleteQuestion", () => {
		it("deletes an existing question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const deleted = await controller.deleteQuestion(q.id);
			expect(deleted).toBe(true);
			const found = await controller.getQuestion(q.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent question", async () => {
			const deleted = await controller.deleteQuestion("nonexistent");
			expect(deleted).toBe(false);
		});

		it("also deletes answers for the question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			await controller.deleteQuestion(q.id);
			const foundAnswer = await controller.getAnswer(a.id);
			expect(foundAnswer).toBeNull();
		});
	});

	// ── upvoteQuestion ──────────────────────────────────────────────────

	describe("upvoteQuestion", () => {
		it("increments the upvote count", async () => {
			const q = await controller.createQuestion(makeQuestion());
			expect(q.upvoteCount).toBe(0);
			const upvoted = await controller.upvoteQuestion(q.id);
			expect(upvoted?.upvoteCount).toBe(1);
		});

		it("increments upvotes multiple times", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.upvoteQuestion(q.id);
			const upvoted = await controller.upvoteQuestion(q.id);
			expect(upvoted?.upvoteCount).toBe(2);
		});

		it("returns null for non-existent question", async () => {
			const result = await controller.upvoteQuestion("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── createAnswer ────────────────────────────────────────────────────

	describe("createAnswer", () => {
		it("creates an answer with pending status by default", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const answer = await controller.createAnswer(makeAnswer(q.id));
			expect(answer.id).toBeDefined();
			expect(answer.questionId).toBe(q.id);
			expect(answer.body).toBe("Yes, it comes in blue and red.");
			expect(answer.status).toBe("pending");
			expect(answer.isOfficial).toBe(false);
			expect(answer.upvoteCount).toBe(0);
		});

		it("creates official answers with published status", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const answer = await controller.createAnswer(
				makeAnswer(q.id, { isOfficial: true }),
			);
			expect(answer.isOfficial).toBe(true);
			expect(answer.status).toBe("published");
		});

		it("increments answerCount on the question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			expect(q.answerCount).toBe(0);
			await controller.createAnswer(makeAnswer(q.id));
			const updated = await controller.getQuestion(q.id);
			expect(updated?.answerCount).toBe(1);
		});

		it("increments answerCount for multiple answers", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.createAnswer(makeAnswer(q.id));
			await controller.createAnswer(
				makeAnswer(q.id, { body: "Second answer" }),
			);
			const updated = await controller.getQuestion(q.id);
			expect(updated?.answerCount).toBe(2);
		});

		it("uses autoPublish for non-official answers", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion(makeQuestion());
			const answer = await autoController.createAnswer(makeAnswer(q.id));
			expect(answer.status).toBe("published");
		});
	});

	// ── getAnswer ───────────────────────────────────────────────────────

	describe("getAnswer", () => {
		it("returns an answer by id", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const created = await controller.createAnswer(makeAnswer(q.id));
			const found = await controller.getAnswer(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getAnswer("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── listAnswersByQuestion ───────────────────────────────────────────

	describe("listAnswersByQuestion", () => {
		it("lists answers for a question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.createAnswer(makeAnswer(q.id));
			await controller.createAnswer(
				makeAnswer(q.id, { body: "Another answer" }),
			);

			const answers = await controller.listAnswersByQuestion(q.id);
			expect(answers).toHaveLength(2);
		});

		it("filters by published status when publishedOnly is true", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a1 = await controller.createAnswer(makeAnswer(q.id));
			await controller.createAnswer(
				makeAnswer(q.id, { body: "Another answer" }),
			);
			await controller.updateAnswerStatus(a1.id, "published");

			const published = await controller.listAnswersByQuestion(q.id, {
				publishedOnly: true,
			});
			expect(published).toHaveLength(1);
			expect(published[0].status).toBe("published");
		});

		it("returns empty array for question with no answers", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const answers = await controller.listAnswersByQuestion(q.id);
			expect(answers).toHaveLength(0);
		});
	});

	// ── updateAnswerStatus ──────────────────────────────────────────────

	describe("updateAnswerStatus", () => {
		it("publishes a pending answer", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			const updated = await controller.updateAnswerStatus(a.id, "published");
			expect(updated?.status).toBe("published");
		});

		it("rejects an answer", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			const updated = await controller.updateAnswerStatus(a.id, "rejected");
			expect(updated?.status).toBe("rejected");
		});

		it("returns null for non-existent answer", async () => {
			const result = await controller.updateAnswerStatus(
				"nonexistent",
				"published",
			);
			expect(result).toBeNull();
		});
	});

	// ── deleteAnswer ────────────────────────────────────────────────────

	describe("deleteAnswer", () => {
		it("deletes an existing answer", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			const deleted = await controller.deleteAnswer(a.id);
			expect(deleted).toBe(true);
			const found = await controller.getAnswer(a.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent answer", async () => {
			const deleted = await controller.deleteAnswer("nonexistent");
			expect(deleted).toBe(false);
		});

		it("decrements answerCount on the question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(1);
			await controller.deleteAnswer(a.id);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(0);
		});

		it("does not go below zero for answerCount", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			// Manually set answerCount to 0 to test floor
			const zeroed: Record<string, unknown> = { ...q, answerCount: 0 };
			await mockData.upsert("question", q.id, zeroed);
			await controller.deleteAnswer(a.id);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(0);
		});
	});

	// ── upvoteAnswer ────────────────────────────────────────────────────

	describe("upvoteAnswer", () => {
		it("increments the upvote count", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			expect(a.upvoteCount).toBe(0);
			const upvoted = await controller.upvoteAnswer(a.id);
			expect(upvoted?.upvoteCount).toBe(1);
		});

		it("increments upvotes multiple times", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			await controller.upvoteAnswer(a.id);
			const upvoted = await controller.upvoteAnswer(a.id);
			expect(upvoted?.upvoteCount).toBe(2);
		});

		it("returns null for non-existent answer", async () => {
			const result = await controller.upvoteAnswer("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── getProductQaSummary ─────────────────────────────────────────────

	describe("getProductQaSummary", () => {
		it("returns zero counts for product with no questions", async () => {
			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(0);
			expect(summary.answeredCount).toBe(0);
			expect(summary.unansweredCount).toBe(0);
		});

		it("counts published questions only", async () => {
			const q1 = await controller.createQuestion(makeQuestion());
			await controller.createQuestion(
				makeQuestion({ body: "Pending question?" }),
			);
			await controller.updateQuestionStatus(q1.id, "published");

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(1);
		});

		it("distinguishes answered vs unanswered", async () => {
			const q1 = await controller.createQuestion(
				makeQuestion({ body: "Question 1?" }),
			);
			const q2 = await controller.createQuestion(
				makeQuestion({ body: "Question 2?" }),
			);
			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "published");
			await controller.createAnswer(makeAnswer(q1.id));

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(2);
			expect(summary.answeredCount).toBe(1);
			expect(summary.unansweredCount).toBe(1);
		});
	});

	// ── getQaAnalytics ──────────────────────────────────────────────────

	describe("getQaAnalytics", () => {
		it("returns zeroed analytics when empty", async () => {
			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(0);
			expect(analytics.totalAnswers).toBe(0);
			expect(analytics.averageAnswersPerQuestion).toBe(0);
		});

		it("counts questions by status", async () => {
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createQuestion(makeQuestion({ body: "Q3?" }));
			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "rejected");
			// q3 stays pending

			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(3);
			expect(analytics.publishedQuestions).toBe(1);
			expect(analytics.rejectedQuestions).toBe(1);
			expect(analytics.pendingQuestions).toBe(1);
		});

		it("counts answers by status and official flag", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a1 = await controller.createAnswer(makeAnswer(q.id));
			await controller.createAnswer(
				makeAnswer(q.id, { isOfficial: true, body: "Official answer" }),
			);
			await controller.updateAnswerStatus(a1.id, "published");

			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalAnswers).toBe(2);
			expect(analytics.publishedAnswers).toBe(2); // official auto-published + a1 published
			expect(analytics.officialAnswers).toBe(1);
		});

		it("calculates average answers per question", async () => {
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createAnswer(makeAnswer(q1.id));
			await controller.createAnswer(
				makeAnswer(q1.id, { body: "Second answer" }),
			);
			await controller.createAnswer(makeAnswer(q2.id));

			const analytics = await controller.getQaAnalytics();
			expect(analytics.averageAnswersPerQuestion).toBe(1.5);
		});

		it("counts unanswered questions", async () => {
			await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createAnswer(makeAnswer(q2.id));

			const analytics = await controller.getQaAnalytics();
			expect(analytics.unansweredCount).toBe(1);
		});
	});

	// ── Module export ───────────────────────────────────────────────────

	describe("module export", () => {
		it("creates a valid module object", () => {
			const mod = productQaModule();
			expect(mod.id).toBe("product-qa");
			expect(mod.version).toBe("0.0.1");
			expect(mod.schema).toBeDefined();
			expect(mod.endpoints?.store).toBeDefined();
			expect(mod.endpoints?.admin).toBeDefined();
		});

		it("initializes controller through init", async () => {
			const mod = productQaModule();
			const ctx = createMockModuleContext();
			const result = await mod.init?.(ctx);
			expect(result?.controllers?.productQa).toBeDefined();
		});

		it("passes autoPublish option", async () => {
			const mod = productQaModule({ autoPublish: "true" });
			const ctx = createMockModuleContext();
			const result = await mod.init?.(ctx);
			const controller = result?.controllers?.productQa as ProductQaController;
			const q = await controller.createQuestion({
				productId: "prod_1",
				authorName: "Test",
				authorEmail: "test@test.com",
				body: "Auto published?",
			});
			expect(q.status).toBe("published");
		});

		it("declares admin pages", () => {
			const mod = productQaModule();
			expect(mod.admin?.pages).toHaveLength(3);
			expect(mod.admin?.pages?.[0]?.path).toBe("/admin/product-qa");
			expect(mod.admin?.pages?.[0]?.label).toBe("Product Q&A");
		});

		it("declares events", () => {
			const mod = productQaModule();
			expect(mod.events?.emits).toContain("question.submitted");
			expect(mod.events?.emits).toContain("answer.official");
		});

		it("declares exports", () => {
			const mod = productQaModule();
			expect(mod.exports?.read).toContain("questionCount");
			expect(mod.exports?.read).toContain("answeredCount");
		});
	});
});
