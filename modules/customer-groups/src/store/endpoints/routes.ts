import { checkMembership } from "./check-membership";
import { myGroups } from "./my-groups";
import { myPricing } from "./my-pricing";

export const storeEndpoints = {
	"/customer-groups/mine": myGroups,
	"/customer-groups/pricing": myPricing,
	"/customer-groups/check": checkMembership,
};
