import { deleteAnswer } from "./delete-answer";
import { deleteQuestion } from "./delete-question";
import { getQuestion } from "./get-question";
import { listQuestions } from "./list-questions";
import { postOfficialAnswer } from "./post-official-answer";
import { publishAnswer } from "./publish-answer";
import { publishQuestion } from "./publish-question";
import { qaAnalytics } from "./qa-analytics";
import { rejectAnswer } from "./reject-answer";
import { rejectQuestion } from "./reject-question";

export const adminEndpoints = {
	"/admin/product-qa/questions": listQuestions,
	"/admin/product-qa/analytics": qaAnalytics,
	"/admin/product-qa/questions/:id": getQuestion,
	"/admin/product-qa/questions/:id/publish": publishQuestion,
	"/admin/product-qa/questions/:id/reject": rejectQuestion,
	"/admin/product-qa/questions/:id/answer": postOfficialAnswer,
	"/admin/product-qa/questions/:id/delete": deleteQuestion,
	"/admin/product-qa/answers/:id/publish": publishAnswer,
	"/admin/product-qa/answers/:id/reject": rejectAnswer,
	"/admin/product-qa/answers/:id/delete": deleteAnswer,
};
