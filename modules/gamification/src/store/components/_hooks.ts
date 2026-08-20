"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useGamificationStoreApi() {
	const client = useModuleClient();
	return {
		getGame: client.module("gamification").store["/gamification/games/:id"],
		canPlay:
			client.module("gamification").store["/gamification/games/:id/can-play"],
		play: client.module("gamification").store["/gamification/games/:id/play"],
		redeemPrize:
			client.module("gamification").store["/gamification/plays/:id/redeem"],
	};
}
