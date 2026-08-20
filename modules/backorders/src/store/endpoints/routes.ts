import { cancelBackorder } from "./cancel-backorder";
import { checkEligibility } from "./check-eligibility";
import { createBackorder } from "./create-backorder";
import { getBackorder } from "./get-backorder";
import { myBackorders } from "./my-backorders";

export const storeEndpoints = {
	"/backorders/create": createBackorder,
	"/backorders/check/:productId": checkEligibility,
	"/backorders/mine": myBackorders,
	"/backorders/:id": getBackorder,
	"/backorders/:id/cancel": cancelBackorder,
};
