import { canPlayEndpoint } from "./can-play";
import { getGameEndpoint } from "./get-game";
import { playGameEndpoint } from "./play-game";
import { redeemPrizeEndpoint } from "./redeem-prize";

export const storeEndpoints = {
	"/gamification/games/:id": getGameEndpoint,
	"/gamification/games/:id/play": playGameEndpoint,
	"/gamification/games/:id/can-play": canPlayEndpoint,
	"/gamification/plays/:id/redeem": redeemPrizeEndpoint,
};
