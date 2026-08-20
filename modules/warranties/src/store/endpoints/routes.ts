import { getClaim } from "./get-claim";
import { getWarranty } from "./get-warranty";
import { listClaims } from "./list-claims";
import { listAvailablePlans } from "./list-plans";
import { listWarranties } from "./list-warranties";
import { submitClaim } from "./submit-claim";

export const storeEndpoints = {
	"/warranties": listWarranties,
	"/warranties/plans": listAvailablePlans,
	"/warranties/claims": listClaims,
	"/warranties/claims/submit": submitClaim,
	"/warranties/claims/:id": getClaim,
	"/warranties/:id": getWarranty,
};
