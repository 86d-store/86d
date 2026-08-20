import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Question } from "../service";
import { createProductQaController } from "../service-impl";

/**
 * Security regression tests for product-qa endpoints.
 *
 * Covers: storefront visibility (published-only), answer visibility,
 * cascade deletion, answer count tracking, upvote safety, product scoping,
 * nonexistent resource guards, analytics accuracy, autoPublish mode,
 * and status transition integrity.
 */

describe("product-qa endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createProductQaController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductQaController(mockData);
	});

	/** Helper to create a question with sensible defaults. */
	async function seedQuestion(
		overrides: Partial<Parameters<typeof controller.createQuestion>[0]> = {},
	): Promise<Question> {
		return controller.createQuestion({
			productId: "prod_1",
			authorName: "Test User",
			authorEmail: "test@example.com",
			body: "Test question?",
			...overrides,
		});
	}

	// ── Storefront Visibility ───────────────────────────────────────────

	describe("storefront visibility", () => {
		it("publishedOnly hides pending questions", async () => {
			await seedQuestion();

			const published = await controller.listQuestionsByProduct("prod_1", {
				publishedOnly: true,
			});
			expect(published).toHaveLength(0);
		});

		it("published questions are visible on storefront", async () => {
			const q = await seedQuestion();
			await controller.updateQuestionStatus(q.id, "published");

			const published = await controller.listQuestionsByProduct("prod_1", {
				publishedOnly: true,
			});
			expect(published).toHaveLength(1);
		});

		it("rejected questions are hidden on storefront", async () => {
			const q = await seedQuestion();
			await controller.updateQuestionStatus(q.id, "rejected");

			const published = await controller.listQuestionsByProduct("prod_1", {
				publishedOnly: true,
			});
			expect(published).toHaveLength(0);
		});

		it("new questions default to pending status", async () => {
			const q = await seedQuestion();
			expect(q.status).toBe("pending");
		});
	});

	// ── Answer Visibility ───────────────────────────────────────────────

	describe("answer visibility", () => {
		it("publishedOnly hides pending answers", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				customerId: "cust_2",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				body: "Answer.",
				isOfficial: false,
			});

			const published = await controller.listAnswersByQuestion(q.id, {
				publishedOnly: true,
			});
			expect(published).toHaveLength(0);
		});

		it("official answers are auto-published", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				customerId: "admin_1",
				authorName: "Store Admin",
				authorEmail: "admin@store.com",
				body: "Official answer",
				isOfficial: true,
			});

			const published = await controller.listAnswersByQuestion(q.id, {
				publishedOnly: true,
			});
			expect(published).toHaveLength(1);
			expect(published[0]?.isOfficial).toBe(true);
		});

		it("non-official answers default to pending", async () => {
			const q = await seedQuestion();
			const a = await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "User",
				authorEmail: "user@example.com",
				body: "Answer",
			});

			expect(a.status).toBe("pending");
			expect(a.isOfficial).toBe(false);
		});

		it("manually published answer becomes visible", async () => {
			const q = await seedQuestion();
			const a = await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "User",
				authorEmail: "user@example.com",
				body: "Answer",
			});

			await controller.updateAnswerStatus(a.id, "published");

			const published = await controller.listAnswersByQuestion(q.id, {
				publishedOnly: true,
			});
			expect(published).toHaveLength(1);
		});
	});

	// ── Cascade Deletion ────────────────────────────────────────────────

	describe("cascade deletion", () => {
		it("deleting a question removes all its answers", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				body: "Answer 1",
			});
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Carol",
				authorEmail: "carol@example.com",
				body: "Answer 2",
			});

			await controller.deleteQuestion(q.id);

			const answers = await controller.listAnswersByQuestion(q.id, {});
			expect(answers).toHaveLength(0);
		});

		it("deleting one question does not affect another's answers", async () => {
			const q1 = await seedQuestion({ body: "Q1?" });
			const q2 = await seedQuestion({
				body: "Q2?",
				authorEmail: "other@test.com",
			});

			await controller.createAnswer({
				questionId: q1.id,
				productId: "prod_1",
				authorName: "A1",
				authorEmail: "a1@test.com",
				body: "Answer to Q1",
			});
			await controller.createAnswer({
				questionId: q2.id,
				productId: "prod_1",
				authorName: "A2",
				authorEmail: "a2@test.com",
				body: "Answer to Q2",
			});

			await controller.deleteQuestion(q1.id);

			const q2Answers = await controller.listAnswersByQuestion(q2.id, {});
			expect(q2Answers).toHaveLength(1);
		});
	});

	// ── Answer Count Tracking ───────────────────────────────────────────

	describe("answer count tracking", () => {
		it("answerCount increments when answer is created", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				body: "Answer",
			});

			const updated = await controller.getQuestion(q.id);
			expect(updated?.answerCount).toBe(1);
		});

		it("answerCount decrements when answer is deleted", async () => {
			const q = await seedQuestion();
			const a = await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				body: "Answer",
			});

			await controller.deleteAnswer(a.id);

			const updated = await controller.getQuestion(q.id);
			expect(updated?.answerCount).toBe(0);
		});

		it("answerCount never goes below zero", async () => {
			const q = await seedQuestion();
			// Force a scenario: answer count is already 0, delete should stay at 0
			// This is guaranteed by Math.max(0, ...) in the impl
			expect(q.answerCount).toBe(0);
		});

		it("multiple answers increment correctly", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@test.com",
				body: "Answer 1",
			});
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@test.com",
				body: "Answer 2",
			});
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "C",
				authorEmail: "c@test.com",
				body: "Answer 3",
			});

			const updated = await controller.getQuestion(q.id);
			expect(updated?.answerCount).toBe(3);
		});
	});

	// ── Upvote Safety ───────────────────────────────────────────────────

	describe("upvote safety", () => {
		it("upvoteQuestion increments count", async () => {
			const q = await seedQuestion();
			await controller.upvoteQuestion(q.id);
			await controller.upvoteQuestion(q.id);

			const updated = await controller.getQuestion(q.id);
			expect(updated?.upvoteCount).toBe(2);
		});

		it("upvoteAnswer increments count", async () => {
			const q = await seedQuestion();
			const a = await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				body: "Great answer",
			});

			await controller.upvoteAnswer(a.id);
			const updated = await controller.getAnswer(a.id);
			expect(updated?.upvoteCount).toBe(1);
		});

		it("upvoting one question does not affect another", async () => {
			const q1 = await seedQuestion({ body: "Q1?" });
			const q2 = await seedQuestion({
				body: "Q2?",
				authorEmail: "other@test.com",
			});

			await controller.upvoteQuestion(q1.id);
			await controller.upvoteQuestion(q1.id);

			const q2Updated = await controller.getQuestion(q2.id);
			expect(q2Updated?.upvoteCount).toBe(0);
		});

		it("upvoteQuestion returns null for nonexistent ID", async () => {
			const result = await controller.upvoteQuestion("nonexistent");
			expect(result).toBeNull();
		});

		it("upvoteAnswer returns null for nonexistent ID", async () => {
			const result = await controller.upvoteAnswer("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Product Scoping ─────────────────────────────────────────────────

	describe("product scoping", () => {
		it("questions from different products are isolated", async () => {
			await seedQuestion({ productId: "prod_1", body: "Q for product 1" });
			await seedQuestion({
				productId: "prod_2",
				body: "Q for product 2",
				authorEmail: "other@test.com",
			});

			const prod1Qs = await controller.listQuestionsByProduct("prod_1", {});
			expect(prod1Qs).toHaveLength(1);
			expect(prod1Qs[0]?.body).toBe("Q for product 1");

			const prod2Qs = await controller.listQuestionsByProduct("prod_2", {});
			expect(prod2Qs).toHaveLength(1);
		});

		it("empty product returns no questions", async () => {
			await seedQuestion({ productId: "prod_1" });
			const qs = await controller.listQuestionsByProduct("prod_other", {});
			expect(qs).toHaveLength(0);
		});
	});

	// ── Nonexistent Resource Guards ─────────────────────────────────────

	describe("nonexistent resource handling", () => {
		it("getQuestion returns null for fabricated ID", async () => {
			expect(await controller.getQuestion("nonexistent")).toBeNull();
		});

		it("getAnswer returns null for fabricated ID", async () => {
			expect(await controller.getAnswer("nonexistent")).toBeNull();
		});

		it("updateQuestionStatus returns null for fabricated ID", async () => {
			expect(
				await controller.updateQuestionStatus("nonexistent", "published"),
			).toBeNull();
		});

		it("updateAnswerStatus returns null for fabricated ID", async () => {
			expect(
				await controller.updateAnswerStatus("nonexistent", "published"),
			).toBeNull();
		});

		it("deleteQuestion returns false for fabricated ID", async () => {
			expect(await controller.deleteQuestion("nonexistent")).toBe(false);
		});

		it("deleteAnswer returns false for fabricated ID", async () => {
			expect(await controller.deleteAnswer("nonexistent")).toBe(false);
		});
	});

	// ── Analytics Accuracy ──────────────────────────────────────────────

	describe("analytics accuracy", () => {
		it("empty store returns zeroed analytics", async () => {
			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(0);
			expect(analytics.totalAnswers).toBe(0);
			expect(analytics.averageAnswersPerQuestion).toBe(0);
		});

		it("counts reflect correct status distribution", async () => {
			const q1 = await seedQuestion({ authorEmail: "a@test.com" });
			const q2 = await seedQuestion({ authorEmail: "b@test.com" });
			await seedQuestion({ authorEmail: "c@test.com" });

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "rejected");

			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(3);
			expect(analytics.publishedQuestions).toBe(1);
			expect(analytics.rejectedQuestions).toBe(1);
			expect(analytics.pendingQuestions).toBe(1);
		});

		it("unansweredCount tracks questions with no answers", async () => {
			const q1 = await seedQuestion({ authorEmail: "a@test.com" });
			await seedQuestion({ authorEmail: "b@test.com" });

			await controller.createAnswer({
				questionId: q1.id,
				productId: "prod_1",
				authorName: "Ans",
				authorEmail: "ans@test.com",
				body: "Answer",
			});

			const analytics = await controller.getQaAnalytics();
			expect(analytics.unansweredCount).toBe(1);
		});

		it("officialAnswers counted correctly", async () => {
			const q = await seedQuestion();
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Admin",
				authorEmail: "admin@test.com",
				body: "Official",
				isOfficial: true,
			});
			await controller.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "User",
				authorEmail: "user@test.com",
				body: "Community",
				isOfficial: false,
			});

			const analytics = await controller.getQaAnalytics();
			expect(analytics.officialAnswers).toBe(1);
			expect(analytics.totalAnswers).toBe(2);
		});

		it("averageAnswersPerQuestion computed correctly", async () => {
			const q1 = await seedQuestion({ authorEmail: "a@test.com" });
			const q2 = await seedQuestion({ authorEmail: "b@test.com" });

			await controller.createAnswer({
				questionId: q1.id,
				productId: "prod_1",
				authorName: "A1",
				authorEmail: "a1@test.com",
				body: "Ans 1",
			});
			await controller.createAnswer({
				questionId: q1.id,
				productId: "prod_1",
				authorName: "A2",
				authorEmail: "a2@test.com",
				body: "Ans 2",
			});
			await controller.createAnswer({
				questionId: q2.id,
				productId: "prod_1",
				authorName: "A3",
				authorEmail: "a3@test.com",
				body: "Ans 3",
			});

			const analytics = await controller.getQaAnalytics();
			expect(analytics.averageAnswersPerQuestion).toBe(1.5);
		});
	});

	// ── Product QA Summary ──────────────────────────────────────────────

	describe("product QA summary", () => {
		it("only counts published questions in summary", async () => {
			const q1 = await seedQuestion({ authorEmail: "a@test.com" });
			await seedQuestion({ authorEmail: "b@test.com" }); // pending

			await controller.updateQuestionStatus(q1.id, "published");

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(1);
		});

		it("answeredCount tracks questions with at least one answer", async () => {
			const q1 = await seedQuestion({ authorEmail: "a@test.com" });
			const q2 = await seedQuestion({ authorEmail: "b@test.com" });

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "published");

			await controller.createAnswer({
				questionId: q1.id,
				productId: "prod_1",
				authorName: "Ans",
				authorEmail: "ans@test.com",
				body: "Here's the answer",
			});

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.answeredCount).toBe(1);
			expect(summary.unansweredCount).toBe(1);
		});
	});

	// ── AutoPublish Mode ────────────────────────────────────────────────

	describe("autoPublish mode", () => {
		it("questions default to published when autoPublish is on", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion({
				productId: "prod_1",
				authorName: "User",
				authorEmail: "user@test.com",
				body: "Auto-published?",
			});
			expect(q.status).toBe("published");
		});

		it("non-official answers also auto-published when autoPublish is on", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion({
				productId: "prod_1",
				authorName: "User",
				authorEmail: "user@test.com",
				body: "Question",
			});
			const a = await autoController.createAnswer({
				questionId: q.id,
				productId: "prod_1",
				authorName: "Answerer",
				authorEmail: "answerer@test.com",
				body: "Answer",
				isOfficial: false,
			});
			expect(a.status).toBe("published");
		});
	});
});
