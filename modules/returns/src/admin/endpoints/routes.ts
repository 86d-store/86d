import { completeReturn } from "./complete-return";
import { getReturn } from "./get-return";
import {
	approveReturnUnavailable as approveReturn,
	cancelReturnUnavailable as cancelReturn,
	rejectReturnUnavailable as rejectReturn,
	updateTrackingUnavailable as updateTracking,
} from "./lifecycle-unavailable";
import { listReturns } from "./list-returns";
import { markReceived } from "./mark-received";
import { returnSummary } from "./return-summary";

export const adminEndpoints = {
	"/admin/returns": listReturns,
	"/admin/returns/summary": returnSummary,
	"/admin/returns/:id": getReturn,
	"/admin/returns/:id/approve": approveReturn,
	"/admin/returns/:id/reject": rejectReturn,
	"/admin/returns/:id/received": markReceived,
	"/admin/returns/:id/complete": completeReturn,
	"/admin/returns/:id/cancel": cancelReturn,
	"/admin/returns/:id/tracking": updateTracking,
};
