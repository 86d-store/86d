"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useReferralsApi() {
	const client = useModuleClient();
	return {
		myCode: client.module("referrals").store["/referrals/my-code"],
		myReferrals: client.module("referrals").store["/referrals/my-referrals"],
		myStats: client.module("referrals").store["/referrals/my-stats"],
		apply: client.module("referrals").store["/referrals/apply"],
	};
}
