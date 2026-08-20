import { addressSummary } from "./address-summary";
import { adminDeleteAddress } from "./delete-address";
import { listAllAddresses } from "./list-all-addresses";

export const adminEndpoints = {
	"/admin/saved-addresses": listAllAddresses,
	"/admin/saved-addresses/summary": addressSummary,
	"/admin/saved-addresses/:id/delete": adminDeleteAddress,
};
