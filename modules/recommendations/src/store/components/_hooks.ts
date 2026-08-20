"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useRecommendationsApi() {
	const client = useModuleClient();
	return {
		getForProduct:
			client.module("recommendations").store["/recommendations/:productId"],
		getTrending:
			client.module("recommendations").store["/recommendations/trending"],
		getPersonalized:
			client.module("recommendations").store["/recommendations/personalized"],
		trackInteraction:
			client.module("recommendations").store["/recommendations/track"],
		recordClick:
			client.module("recommendations").store["/recommendations/click"],
	};
}
