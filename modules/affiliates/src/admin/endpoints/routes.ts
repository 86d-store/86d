import { approveAffiliateEndpoint } from "./approve-affiliate";
import { approveConversionEndpoint } from "./approve-conversion";
import { completePayoutEndpoint } from "./complete-payout";
import { createPayoutEndpoint } from "./create-payout";
import { failPayoutEndpoint } from "./fail-payout";
import { getAffiliateEndpoint } from "./get-affiliate";
import { listAffiliatesEndpoint } from "./list-affiliates";
import { listConversionsEndpoint } from "./list-conversions";
import { listLinksEndpoint } from "./list-links";
import { listPayoutsEndpoint } from "./list-payouts";
import { rejectAffiliateEndpoint } from "./reject-affiliate";
import { rejectConversionEndpoint } from "./reject-conversion";
import { statsEndpoint } from "./stats";
import { suspendAffiliateEndpoint } from "./suspend-affiliate";
import { updateAffiliateEndpoint } from "./update-affiliate";

export const adminEndpoints = {
	"/admin/affiliates": listAffiliatesEndpoint,
	"/admin/affiliates/stats": statsEndpoint,
	"/admin/affiliates/conversions": listConversionsEndpoint,
	"/admin/affiliates/links": listLinksEndpoint,
	"/admin/affiliates/payouts": listPayoutsEndpoint,
	"/admin/affiliates/payouts/create": createPayoutEndpoint,
	"/admin/affiliates/:id": getAffiliateEndpoint,
	"/admin/affiliates/:id/approve": approveAffiliateEndpoint,
	"/admin/affiliates/:id/suspend": suspendAffiliateEndpoint,
	"/admin/affiliates/:id/reject": rejectAffiliateEndpoint,
	"/admin/affiliates/:id/update": updateAffiliateEndpoint,
	"/admin/affiliates/conversions/:id/approve": approveConversionEndpoint,
	"/admin/affiliates/conversions/:id/reject": rejectConversionEndpoint,
	"/admin/affiliates/payouts/:id/complete": completePayoutEndpoint,
	"/admin/affiliates/payouts/:id/fail": failPayoutEndpoint,
};
