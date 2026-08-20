"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCustomerApi() {
	const client = useModuleClient();
	return {
		getMe: client.module("customers").store["/customers/me"],
		updateMe: client.module("customers").store["/customers/me/update"],
		listAddresses: client.module("customers").store["/customers/me/addresses"],
		createAddress:
			client.module("customers").store["/customers/me/addresses/create"],
		updateAddress:
			client.module("customers").store["/customers/me/addresses/:id"],
		deleteAddress:
			client.module("customers").store["/customers/me/addresses/:id/delete"],
	};
}
