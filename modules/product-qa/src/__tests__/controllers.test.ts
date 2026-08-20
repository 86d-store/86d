import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductQaController } from "../service-impl";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Controller = ReturnType<typeof createProductQaController>;

function makeQuestion(overrides: Record<string, unknown> = {}) {
	return {
		productId: "prod_1",
		authorName: "Alice",
		authorEmail: "alice@test.com",
		body: "Does this come in blue?",
		...overrides,
	} as Parameters<Controller["createQuestion"]>[0];
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
	} as Parameters<Controller["createAnswer"]>[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("product-qa controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: Controller;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductQaController(mockData);
	});

	// ── autoPublish option behavior ─────────────────────────────────

	describe("autoPublish option behavior", () => {
		it("questions default to pending without autoPublish", async () => {
			const q = await controller.createQuestion(makeQuestion());
			expect(q.status).toBe("pending");
		});

		it("questions are published with autoPublish enabled", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion(makeQuestion());
			expect(q.status).toBe("published");
		});

		it("non-official answers default to pending without autoPublish", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			expect(a.status).toBe("pending");
		});

		it("non-official answers are published with autoPublish enabled", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion(makeQuestion());
			const a = await autoController.createAnswer(makeAnswer(q.id));
			expect(a.status).toBe("published");
			expect(a.isOfficial).toBe(false);
		});

		it("official answers always get published status even without autoPublish", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(
				makeAnswer(q.id, { isOfficial: true }),
			);
			expect(a.status).toBe("published");
			expect(a.isOfficial).toBe(true);
		});

		it("official answers get published status with autoPublish enabled too", async () => {
			const autoController = createProductQaController(mockData, {
				autoPublish: true,
			});
			const q = await autoController.createQuestion(makeQuestion());
			const a = await autoController.createAnswer(
				makeAnswer(q.id, { isOfficial: true }),
			);
			expect(a.status).toBe("published");
			expect(a.isOfficial).toBe(true);
		});
	});

	// ── answerCount tracking ────────────────────────────────────────

	describe("answerCount tracking", () => {
		it("createAnswer increments answerCount on the parent question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			expect(q.answerCount).toBe(0);

			await controller.createAnswer(makeAnswer(q.id));
			const after1 = await controller.getQuestion(q.id);
			expect(after1?.answerCount).toBe(1);

			await controller.createAnswer(
				makeAnswer(q.id, { body: "Second answer" }),
			);
			const after2 = await controller.getQuestion(q.id);
			expect(after2?.answerCount).toBe(2);

			await controller.createAnswer(makeAnswer(q.id, { body: "Third answer" }));
			const after3 = await controller.getQuestion(q.id);
			expect(after3?.answerCount).toBe(3);
		});

		it("deleteAnswer decrements answerCount on the parent question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a1 = await controller.createAnswer(makeAnswer(q.id));
			const a2 = await controller.createAnswer(
				makeAnswer(q.id, { body: "Another answer" }),
			);

			expect((await controller.getQuestion(q.id))?.answerCount).toBe(2);

			await controller.deleteAnswer(a1.id);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(1);

			await controller.deleteAnswer(a2.id);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(0);
		});

		it("answerCount never goes below zero", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));

			// Manually force answerCount to 0 to simulate an edge case
			const zeroed: Record<string, unknown> = {
				...(await controller.getQuestion(q.id)),
				answerCount: 0,
			};
			await mockData.upsert("question", q.id, zeroed);

			await controller.deleteAnswer(a.id);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(0);
		});

		it("deleting a non-existent answer does not affect any question", async () => {
			const q = await controller.createQuestion(makeQuestion());
			await controller.createAnswer(makeAnswer(q.id));

			const deleted = await controller.deleteAnswer("nonexistent");
			expect(deleted).toBe(false);
			expect((await controller.getQuestion(q.id))?.answerCount).toBe(1);
		});
	});

	// ── Cascade delete ──────────────────────────────────────────────

	describe("cascade delete on question removal", () => {
		it("deleting a question removes all its answers", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a1 = await controller.createAnswer(makeAnswer(q.id));
			const a2 = await controller.createAnswer(
				makeAnswer(q.id, { body: "Second answer" }),
			);
			const a3 = await controller.createAnswer(
				makeAnswer(q.id, { body: "Third answer" }),
			);

			await controller.deleteQuestion(q.id);

			expect(await controller.getAnswer(a1.id)).toBeNull();
			expect(await controller.getAnswer(a2.id)).toBeNull();
			expect(await controller.getAnswer(a3.id)).toBeNull();
		});

		it("deleting a question does not affect answers for other questions", async () => {
			const q1 = await controller.createQuestion(
				makeQuestion({ body: "Question 1?" }),
			);
			const q2 = await controller.createQuestion(
				makeQuestion({ body: "Question 2?" }),
			);

			await controller.createAnswer(makeAnswer(q1.id, { body: "A for Q1" }));
			const a2 = await controller.createAnswer(
				makeAnswer(q2.id, { body: "A for Q2" }),
			);

			await controller.deleteQuestion(q1.id);

			// Q2's answer should still exist
			const found = await controller.getAnswer(a2.id);
			expect(found).not.toBeNull();
			expect(found?.body).toBe("A for Q2");
		});

		it("deleting a non-existent question returns false", async () => {
			const result = await controller.deleteQuestion("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Upvote behavior ─────────────────────────────────────────────

	describe("upvote behavior", () => {
		it("upvoting a question multiple times accumulates correctly", async () => {
			const q = await controller.createQuestion(makeQuestion());
			expect(q.upvoteCount).toBe(0);

			await controller.upvoteQuestion(q.id);
			await controller.upvoteQuestion(q.id);
			await controller.upvoteQuestion(q.id);
			const updated = await controller.upvoteQuestion(q.id);
			expect(updated?.upvoteCount).toBe(4);
		});

		it("upvoting an answer multiple times accumulates correctly", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			expect(a.upvoteCount).toBe(0);

			await controller.upvoteAnswer(a.id);
			await controller.upvoteAnswer(a.id);
			const updated = await controller.upvoteAnswer(a.id);
			expect(updated?.upvoteCount).toBe(3);
		});

		it("upvoting a non-existent question returns null", async () => {
			const result = await controller.upvoteQuestion("nonexistent");
			expect(result).toBeNull();
		});

		it("upvoting a non-existent answer returns null", async () => {
			const result = await controller.upvoteAnswer("nonexistent");
			expect(result).toBeNull();
		});

		it("upvoting a question updates its updatedAt timestamp", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const originalUpdatedAt = q.updatedAt;
			const upvoted = await controller.upvoteQuestion(q.id);
			expect(upvoted?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("upvoting an answer updates its updatedAt timestamp", async () => {
			const q = await controller.createQuestion(makeQuestion());
			const a = await controller.createAnswer(makeAnswer(q.id));
			const originalUpdatedAt = a.updatedAt;
			const upvoted = await controller.upvoteAnswer(a.id);
			expect(upvoted?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});
	});

	// ── getProductQaSummary ─────────────────────────────────────────

	describe("getProductQaSummary — edge cases", () => {
		it("only counts published questions, ignoring pending and rejected", async () => {
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createQuestion(makeQuestion({ body: "Q3?" }));

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "rejected");
			// q3 stays pending

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(1);
			expect(summary.unansweredCount).toBe(1);
		});

		it("returns zeroes for a product with no questions", async () => {
			const summary = await controller.getProductQaSummary("prod_nonexistent");
			expect(summary.questionCount).toBe(0);
			expect(summary.answeredCount).toBe(0);
			expect(summary.unansweredCount).toBe(0);
		});

		it("correctly distinguishes answered vs unanswered published questions", async () => {
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			const q3 = await controller.createQuestion(makeQuestion({ body: "Q3?" }));

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "published");
			await controller.updateQuestionStatus(q3.id, "published");

			// Only q1 gets an answer
			await controller.createAnswer(makeAnswer(q1.id));

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(3);
			expect(summary.answeredCount).toBe(1);
			expect(summary.unansweredCount).toBe(2);
		});

		it("does not count questions from other products", async () => {
			const q1 = await controller.createQuestion(
				makeQuestion({ productId: "prod_1", body: "Q for prod1?" }),
			);
			const q2 = await controller.createQuestion(
				makeQuestion({ productId: "prod_2", body: "Q for prod2?" }),
			);

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "published");

			const summary = await controller.getProductQaSummary("prod_1");
			expect(summary.questionCount).toBe(1);
		});
	});

	// ── getQaAnalytics ──────────────────────────────────────────────

	describe("getQaAnalytics — mixed statuses and rounding", () => {
		it("returns zeroed analytics when no data exists", async () => {
			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(0);
			expect(analytics.pendingQuestions).toBe(0);
			expect(analytics.publishedQuestions).toBe(0);
			expect(analytics.rejectedQuestions).toBe(0);
			expect(analytics.totalAnswers).toBe(0);
			expect(analytics.pendingAnswers).toBe(0);
			expect(analytics.publishedAnswers).toBe(0);
			expect(analytics.officialAnswers).toBe(0);
			expect(analytics.averageAnswersPerQuestion).toBe(0);
			expect(analytics.unansweredCount).toBe(0);
		});

		it("counts mixed statuses across questions and answers", async () => {
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createQuestion(makeQuestion({ body: "Q3?" }));

			await controller.updateQuestionStatus(q1.id, "published");
			await controller.updateQuestionStatus(q2.id, "rejected");
			// q3 stays pending

			// Add answers: one official (auto-published), one pending, one rejected
			await controller.createAnswer(
				makeAnswer(q1.id, { isOfficial: true, body: "Official answer" }),
			);
			const a2 = await controller.createAnswer(
				makeAnswer(q1.id, { body: "Community answer" }),
			);
			await controller.updateAnswerStatus(a2.id, "rejected");

			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(3);
			expect(analytics.publishedQuestions).toBe(1);
			expect(analytics.rejectedQuestions).toBe(1);
			expect(analytics.pendingQuestions).toBe(1);
			expect(analytics.totalAnswers).toBe(2);
			expect(analytics.officialAnswers).toBe(1);
			expect(analytics.publishedAnswers).toBe(1); // only the official one is published
			expect(analytics.unansweredCount).toBe(2); // q2 and q3 have 0 answers
		});

		it("averageAnswersPerQuestion rounds to one decimal place", async () => {
			// 3 questions, 1 answer => 0.3333... => 0.3
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createQuestion(makeQuestion({ body: "Q3?" }));
			await controller.createAnswer(makeAnswer(q1.id));

			const analytics = await controller.getQaAnalytics();
			expect(analytics.averageAnswersPerQuestion).toBe(0.3);
		});

		it("averageAnswersPerQuestion rounds 0.666... to 0.7", async () => {
			// 3 questions, 2 answers => 0.6666... => 0.7
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createQuestion(makeQuestion({ body: "Q3?" }));
			await controller.createAnswer(makeAnswer(q1.id));
			await controller.createAnswer(
				makeAnswer(q1.id, { body: "Second answer" }),
			);

			const analytics = await controller.getQaAnalytics();
			expect(analytics.averageAnswersPerQuestion).toBe(0.7);
		});

		it("averageAnswersPerQuestion is exact when evenly divisible", async () => {
			// 2 questions, 3 answers => 1.5
			const q1 = await controller.createQuestion(makeQuestion({ body: "Q1?" }));
			const q2 = await controller.createQuestion(makeQuestion({ body: "Q2?" }));
			await controller.createAnswer(makeAnswer(q1.id));
			await controller.createAnswer(makeAnswer(q1.id, { body: "Second" }));
			await controller.createAnswer(makeAnswer(q2.id));

			const analytics = await controller.getQaAnalytics();
			expect(analytics.averageAnswersPerQuestion).toBe(1.5);
		});
	});

	// ── Cross-product isolation ─────────────────────────────────────

	describe("cross-product isolation", () => {
		it("listQuestionsByProduct returns only questions for that product", async () => {
			await controller.createQuestion(
				makeQuestion({ productId: "prod_A", body: "Q for A?" }),
			);
			await controller.createQuestion(
				makeQuestion({ productId: "prod_A", body: "Another Q for A?" }),
			);
			await controller.createQuestion(
				makeQuestion({ productId: "prod_B", body: "Q for B?" }),
			);

			const questionsA = await controller.listQuestionsByProduct("prod_A");
			expect(questionsA).toHaveLength(2);

			const questionsB = await controller.listQuestionsByProduct("prod_B");
			expect(questionsB).toHaveLength(1);
		});

		it("listQuestions filters by both productId and status simultaneously", async () => {
			const q1 = await controller.createQuestion(
				makeQuestion({ productId: "prod_A", body: "Q1 for A?" }),
			);
			await controller.createQuestion(
				makeQuestion({ productId: "prod_A", body: "Q2 for A?" }),
			);
			await controller.createQuestion(
				makeQuestion({ productId: "prod_B", body: "Q1 for B?" }),
			);

			await controller.updateQuestionStatus(q1.id, "published");

			const filtered = await controller.listQuestions({
				productId: "prod_A",
				status: "published",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0]?.body).toBe("Q1 for A?");
		});
	});

	// ── Status update on non-existent entities ──────────────────────

	describe("status updates on non-existent entities", () => {
		it("updateQuestionStatus returns null for non-existent question", async () => {
			const result = await controller.updateQuestionStatus(
				"nonexistent",
				"published",
			);
			expect(result).toBeNull();
		});

		it("updateAnswerStatus returns null for non-existent answer", async () => {
			const result = await controller.updateAnswerStatus(
				"nonexistent",
				"published",
			);
			expect(result).toBeNull();
		});
	});

	// ── Full lifecycle scenario ─────────────────────────────────────

	describe("full lifecycle scenario", () => {
		it("question submission through answer and analytics flow", async () => {
			// Step 1: Create questions
			const q1 = await controller.createQuestion(
				makeQuestion({ body: "Is this waterproof?" }),
			);
			await controller.createQuestion(
				makeQuestion({ body: "What is the warranty?" }),
			);

			// Step 2: Publish q1, keep q2 pending
			await controller.updateQuestionStatus(q1.id, "published");

			// Step 3: Add official answer to q1
			await controller.createAnswer(
				makeAnswer(q1.id, {
					isOfficial: true,
					body: "Yes, it is waterproof up to 50m.",
				}),
			);

			// Step 4: Add community answer to q1
			const communityAnswer = await controller.createAnswer(
				makeAnswer(q1.id, {
					authorName: "Charlie",
					authorEmail: "charlie@test.com",
					body: "I tested it in rain, works great!",
				}),
			);

			// Step 5: Upvote the community answer
			await controller.upvoteAnswer(communityAnswer.id);
			await controller.upvoteAnswer(communityAnswer.id);

			// Step 6: Upvote the question
			await controller.upvoteQuestion(q1.id);

			// Step 7: Verify question state
			const q1Final = await controller.getQuestion(q1.id);
			expect(q1Final?.answerCount).toBe(2);
			expect(q1Final?.upvoteCount).toBe(1);
			expect(q1Final?.status).toBe("published");

			// Step 8: Verify answer state
			const communityFinal = await controller.getAnswer(communityAnswer.id);
			expect(communityFinal?.upvoteCount).toBe(2);

			// Step 9: Verify analytics
			const analytics = await controller.getQaAnalytics();
			expect(analytics.totalQuestions).toBe(2);
			expect(analytics.publishedQuestions).toBe(1);
			expect(analytics.pendingQuestions).toBe(1);
			expect(analytics.totalAnswers).toBe(2);
			expect(analytics.officialAnswers).toBe(1);
			expect(analytics.unansweredCount).toBe(1); // q2 has no answers

			// Step 10: Verify product summary
			const summary = await controller.getProductQaSummary("prod_1");
			// Only published questions count
			expect(summary.questionCount).toBe(1);
			expect(summary.answeredCount).toBe(1);
			expect(summary.unansweredCount).toBe(0);

			// Step 11: Delete community answer, verify answerCount decrements
			await controller.deleteAnswer(communityAnswer.id);
			const q1AfterDelete = await controller.getQuestion(q1.id);
			expect(q1AfterDelete?.answerCount).toBe(1);

			// Step 12: Delete question, verify cascade
			const officialAnswers = await controller.listAnswersByQuestion(q1.id);
			const officialId = officialAnswers[0]?.id;
			await controller.deleteQuestion(q1.id);
			expect(await controller.getQuestion(q1.id)).toBeNull();
			if (officialId) {
				expect(await controller.getAnswer(officialId)).toBeNull();
			}
		});
	});
});
