import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Answer, ProductQaController, Question } from "./service";

export function createProductQaController(
	data: ModuleDataService,
	options?: { autoPublish?: boolean },
	events?: ScopedEventEmitter | undefined,
): ProductQaController {
	const defaultStatus = options?.autoPublish === true ? "published" : "pending";

	return {
		// ── Questions ────────────────────────────────────────────────────

		async createQuestion(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const question: Question = {
				id,
				productId: params.productId,
				customerId: params.customerId,
				authorName: params.authorName,
				authorEmail: params.authorEmail,
				body: params.body,
				status: defaultStatus,
				upvoteCount: 0,
				answerCount: 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("question", id, question as Record<string, unknown>);
			void events?.emit("question.submitted", {
				questionId: id,
				productId: params.productId,
				authorName: params.authorName,
			});
			return question;
		},

		async getQuestion(id) {
			const raw = await data.get("question", id);
			if (!raw) return null;
			return raw as unknown as Question;
		},

		async listQuestionsByProduct(productId, params) {
			const where: Record<string, unknown> = { productId };
			if (params?.publishedOnly) where.status = "published";

			const all = await data.findMany("question", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Question[];
		},

		async listQuestions(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("question", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Question[];
		},

		async updateQuestionStatus(id, status) {
			const existing = await data.get("question", id);
			if (!existing) return null;
			const question = existing as unknown as Question;
			const updated: Question = {
				...question,
				status,
				updatedAt: new Date(),
			};
			await data.upsert("question", id, updated as Record<string, unknown>);
			if (status === "published") {
				void events?.emit("question.published", { questionId: id });
			} else if (status === "rejected") {
				void events?.emit("question.rejected", { questionId: id });
			}
			return updated;
		},

		async deleteQuestion(id) {
			const existing = await data.get("question", id);
			if (!existing) return false;
			// Also delete all answers for this question
			const answers = await data.findMany("answer", {
				where: { questionId: id },
			});
			for (const answer of answers) {
				const a = answer as unknown as Answer;
				await data.delete("answer", a.id);
			}
			await data.delete("question", id);
			return true;
		},

		async upvoteQuestion(id) {
			const existing = await data.get("question", id);
			if (!existing) return null;
			const question = existing as unknown as Question;
			const updated: Question = {
				...question,
				upvoteCount: question.upvoteCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert("question", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Answers ──────────────────────────────────────────────────────

		async createAnswer(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const answer: Answer = {
				id,
				questionId: params.questionId,
				productId: params.productId,
				authorName: params.authorName,
				authorEmail: params.authorEmail,
				body: params.body,
				customerId: params.customerId,
				isOfficial: params.isOfficial ?? false,
				upvoteCount: 0,
				status: params.isOfficial ? "published" : defaultStatus,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("answer", id, answer as Record<string, unknown>);
			void events?.emit("answer.submitted", {
				answerId: id,
				questionId: params.questionId,
				productId: params.productId,
			});
			if (params.isOfficial) {
				void events?.emit("answer.official", {
					answerId: id,
					questionId: params.questionId,
				});
			}

			// Increment answerCount on the question
			const question = await data.get("question", params.questionId);
			if (question) {
				const q = question as unknown as Question;
				const updatedQ: Question = {
					...q,
					answerCount: q.answerCount + 1,
					updatedAt: new Date(),
				};
				await data.upsert(
					"question",
					q.id,
					updatedQ as Record<string, unknown>,
				);
			}

			return answer;
		},

		async getAnswer(id) {
			const raw = await data.get("answer", id);
			if (!raw) return null;
			return raw as unknown as Answer;
		},

		async listAnswersByQuestion(questionId, params) {
			const where: Record<string, unknown> = { questionId };
			if (params?.publishedOnly) where.status = "published";

			const all = await data.findMany("answer", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Answer[];
		},

		async updateAnswerStatus(id, status) {
			const existing = await data.get("answer", id);
			if (!existing) return null;
			const answer = existing as unknown as Answer;
			const updated: Answer = {
				...answer,
				status,
				updatedAt: new Date(),
			};
			await data.upsert("answer", id, updated as Record<string, unknown>);
			if (status === "published") {
				void events?.emit("answer.published", {
					answerId: id,
					questionId: answer.questionId,
				});
			}
			return updated;
		},

		async deleteAnswer(id) {
			const existing = await data.get("answer", id);
			if (!existing) return false;
			const answer = existing as unknown as Answer;

			await data.delete("answer", id);

			// Decrement answerCount on the question
			const question = await data.get("question", answer.questionId);
			if (question) {
				const q = question as unknown as Question;
				const updatedQ: Question = {
					...q,
					answerCount: Math.max(0, q.answerCount - 1),
					updatedAt: new Date(),
				};
				await data.upsert(
					"question",
					q.id,
					updatedQ as Record<string, unknown>,
				);
			}

			return true;
		},

		async upvoteAnswer(id) {
			const existing = await data.get("answer", id);
			if (!existing) return null;
			const answer = existing as unknown as Answer;
			const updated: Answer = {
				...answer,
				upvoteCount: answer.upvoteCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert("answer", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Analytics ────────────────────────────────────────────────────

		async getProductQaSummary(productId) {
			const questions = (await data.findMany("question", {
				where: { productId, status: "published" },
			})) as unknown as Question[];

			let answeredCount = 0;
			for (const q of questions) {
				if (q.answerCount > 0) answeredCount++;
			}

			return {
				questionCount: questions.length,
				answeredCount,
				unansweredCount: questions.length - answeredCount,
			};
		},

		async getQaAnalytics() {
			const allQuestions = (await data.findMany(
				"question",
				{},
			)) as unknown as Question[];
			const allAnswers = (await data.findMany(
				"answer",
				{},
			)) as unknown as Answer[];

			let pendingQuestions = 0;
			let publishedQuestions = 0;
			let rejectedQuestions = 0;
			let unansweredCount = 0;

			for (const q of allQuestions) {
				if (q.status === "pending") pendingQuestions++;
				else if (q.status === "published") publishedQuestions++;
				else if (q.status === "rejected") rejectedQuestions++;
				if (q.answerCount === 0) unansweredCount++;
			}

			let pendingAnswers = 0;
			let publishedAnswers = 0;
			let officialAnswers = 0;

			for (const a of allAnswers) {
				if (a.status === "pending") pendingAnswers++;
				else if (a.status === "published") publishedAnswers++;
				if (a.isOfficial) officialAnswers++;
			}

			return {
				totalQuestions: allQuestions.length,
				pendingQuestions,
				publishedQuestions,
				rejectedQuestions,
				totalAnswers: allAnswers.length,
				pendingAnswers,
				publishedAnswers,
				officialAnswers,
				averageAnswersPerQuestion:
					allQuestions.length > 0
						? Math.round((allAnswers.length / allQuestions.length) * 10) / 10
						: 0,
				unansweredCount,
			};
		},
	};
}
