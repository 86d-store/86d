import { getApplicableRates } from "./get-rates";

export const storeEndpoints = {
	"/tax/rates": getApplicableRates,
};
