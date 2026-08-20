import { listMyReviews } from "./list-my-reviews";
import { listProductReviews } from "./list-product-reviews";
import { markHelpful } from "./mark-helpful";
import { reportReview } from "./report-review";
import { submitReview } from "./submit-review";

export const storeEndpoints = {
	"/reviews": submitReview,
	"/reviews/me": listMyReviews,
	"/reviews/products/:productId": listProductReviews,
	"/reviews/:id/helpful": markHelpful,
	"/reviews/:id/report": reportReview,
};
