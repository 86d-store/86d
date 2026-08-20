"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useSocialProofApi() {
	const client = useModuleClient();
	return {
		trackEvent: client.module("social-proof").store["/social-proof/track"],
		getProductActivity:
			client.module("social-proof").store["/social-proof/activity/:productId"],
		getTrending: client.module("social-proof").store["/social-proof/trending"],
		listBadges: client.module("social-proof").store["/social-proof/badges"],
		getRecentActivity:
			client.module("social-proof").store["/social-proof/recent"],
	};
}
