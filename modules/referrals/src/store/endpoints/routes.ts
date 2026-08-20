import { applyCodeEndpoint } from "./apply-code";
import { getMyCodeEndpoint } from "./get-my-code";
import { myReferralsEndpoint } from "./my-referrals";
import { myStatsEndpoint } from "./my-stats";

export const storeEndpoints = {
	"/referrals/my-code": getMyCodeEndpoint,
	"/referrals/my-referrals": myReferralsEndpoint,
	"/referrals/my-stats": myStatsEndpoint,
	"/referrals/apply": applyCodeEndpoint,
};
