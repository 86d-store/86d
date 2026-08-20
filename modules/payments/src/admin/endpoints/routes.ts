import { getIntentAdmin } from "./get-intent";
import { listIntents } from "./list-intents";
import { listRefunds } from "./list-refunds";
import { createRefundUnavailable as createRefund } from "./refund-unavailable";

export const adminEndpoints = {
	"/admin/payments": listIntents,
	"/admin/payments/:id": getIntentAdmin,
	"/admin/payments/:id/refund": createRefund,
	"/admin/payments/:id/refunds": listRefunds,
};
