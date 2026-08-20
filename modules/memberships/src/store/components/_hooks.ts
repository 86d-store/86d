"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useMembershipsApi() {
	const client = useModuleClient();
	return {
		listPlans: client.module("memberships").store["/memberships/plans"],
		getPlan: client.module("memberships").store["/memberships/plans/:slug"],
		getMyMembership:
			client.module("memberships").store["/memberships/my-membership"],
		subscribe: client.module("memberships").store["/memberships/subscribe"],
		cancel: client.module("memberships").store["/memberships/cancel"],
		checkAccess:
			client.module("memberships").store["/memberships/check-access"],
	};
}
