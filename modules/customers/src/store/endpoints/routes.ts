import { createAddress } from "./create-address";
import { deleteAddress } from "./delete-address";
import { getMe } from "./get-me";
import { listAddresses } from "./list-addresses";
import { updateAddress } from "./update-address";
import { updateMe } from "./update-me";

export const storeEndpoints = {
	"/customers/me": getMe,
	"/customers/me/update": updateMe,
	"/customers/me/addresses": listAddresses,
	"/customers/me/addresses/create": createAddress,
	"/customers/me/addresses/:id": updateAddress,
	"/customers/me/addresses/:id/delete": deleteAddress,
};
