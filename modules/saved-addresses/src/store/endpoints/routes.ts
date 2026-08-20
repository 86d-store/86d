import { createAddress } from "./create-address";
import { deleteAddress } from "./delete-address";
import { getAddress } from "./get-address";
import { getDefaultAddress, getDefaultBillingAddress } from "./get-default";
import { listAddresses } from "./list-addresses";
import { setDefaultAddress, setDefaultBillingAddress } from "./set-default";
import { updateAddress } from "./update-address";

export const storeEndpoints = {
	"/addresses": listAddresses,
	"/addresses/create": createAddress,
	"/addresses/default": getDefaultAddress,
	"/addresses/default-billing": getDefaultBillingAddress,
	"/addresses/:id": getAddress,
	"/addresses/:id/update": updateAddress,
	"/addresses/:id/delete": deleteAddress,
	"/addresses/:id/set-default": setDefaultAddress,
	"/addresses/:id/set-default-billing": setDefaultBillingAddress,
};
