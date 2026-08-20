import { completeReferralEndpoint } from "./complete-referral";
import { createRewardRuleEndpoint } from "./create-reward-rule";
import { deactivateCodeEndpoint } from "./deactivate-code";
import { deleteRewardRuleEndpoint } from "./delete-reward-rule";
import { getCodeEndpoint } from "./get-code";
import { getReferralEndpoint } from "./get-referral";
import { listCodesEndpoint } from "./list-codes";
import { listReferralsEndpoint } from "./list-referrals";
import { listRewardRulesEndpoint } from "./list-reward-rules";
import { revokeReferralEndpoint } from "./revoke-referral";
import { statsEndpoint } from "./stats";
import { updateRewardRuleEndpoint } from "./update-reward-rule";

export const adminEndpoints = {
	"/admin/referrals": listReferralsEndpoint,
	"/admin/referrals/codes": listCodesEndpoint,
	"/admin/referrals/stats": statsEndpoint,
	"/admin/referrals/rules": listRewardRulesEndpoint,
	"/admin/referrals/rules/create": createRewardRuleEndpoint,
	"/admin/referrals/codes/:id": getCodeEndpoint,
	"/admin/referrals/codes/:id/deactivate": deactivateCodeEndpoint,
	"/admin/referrals/:id": getReferralEndpoint,
	"/admin/referrals/:id/complete": completeReferralEndpoint,
	"/admin/referrals/:id/revoke": revokeReferralEndpoint,
	"/admin/referrals/rules/:id/update": updateRewardRuleEndpoint,
	"/admin/referrals/rules/:id/delete": deleteRewardRuleEndpoint,
};
