"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePagesApi() {
	const client = useModuleClient();
	return {
		listPages: client.module("pages").store["/pages"],
		getPage: client.module("pages").store["/pages/:slug"],
		getNavigation: client.module("pages").store["/pages/navigation"],
	};
}
