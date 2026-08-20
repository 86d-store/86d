"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useAddressApi() {
	const client = useModuleClient();
	return {
		listAddresses: client.module("saved-addresses").store["/addresses"],
		createAddress: client.module("saved-addresses").store["/addresses/create"],
		updateAddress:
			client.module("saved-addresses").store["/addresses/:id/update"],
		deleteAddress:
			client.module("saved-addresses").store["/addresses/:id/delete"],
		setDefault:
			client.module("saved-addresses").store["/addresses/:id/set-default"],
		setDefaultBilling:
			client.module("saved-addresses").store[
				"/addresses/:id/set-default-billing"
			],
	};
}
