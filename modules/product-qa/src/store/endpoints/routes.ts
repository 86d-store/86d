import { listAnswers } from "./list-answers";
import { listProductQuestions } from "./list-product-questions";
import { productQaSummary } from "./product-qa-summary";
import { submitAnswer } from "./submit-answer";
import { submitQuestion } from "./submit-question";
import { upvoteAnswer } from "./upvote-answer";
import { upvoteQuestion } from "./upvote-question";

export const storeEndpoints = {
	"/product-qa/questions": submitQuestion,
	"/product-qa/products/:productId/questions": listProductQuestions,
	"/product-qa/products/:productId/summary": productQaSummary,
	"/product-qa/questions/:questionId/answer": submitAnswer,
	"/product-qa/questions/:questionId/answers": listAnswers,
	"/product-qa/questions/:id/upvote": upvoteQuestion,
	"/product-qa/answers/:id/upvote": upvoteAnswer,
};
