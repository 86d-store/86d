import { approveReview } from "./approve-review";
import { deleteReview } from "./delete-review";
import { getReview } from "./get-review";
import { listReports } from "./list-reports";
import { listReviewRequests } from "./list-review-requests";
import { listReviews } from "./list-reviews";
import { rejectReview } from "./reject-review";
import { respondReview } from "./respond-review";
import { reviewAnalytics } from "./review-analytics";
import { reviewRequestStats } from "./review-request-stats";
import { sendReviewRequest } from "./send-review-request";
import { updateReport } from "./update-report";

export const adminEndpoints = {
	"/admin/reviews": listReviews,
	"/admin/reviews/analytics": reviewAnalytics,
	"/admin/reviews/reports": listReports,
	"/admin/reviews/reports/:id/update": updateReport,
	"/admin/reviews/requests": listReviewRequests,
	"/admin/reviews/request-stats": reviewRequestStats,
	"/admin/reviews/send-request": sendReviewRequest,
	"/admin/reviews/:id": getReview,
	"/admin/reviews/:id/approve": approveReview,
	"/admin/reviews/:id/reject": rejectReview,
	"/admin/reviews/:id/respond": respondReview,
	"/admin/reviews/:id/delete": deleteReview,
};
