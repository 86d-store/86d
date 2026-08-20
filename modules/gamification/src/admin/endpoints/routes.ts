import { addPrizeEndpoint } from "./add-prize";
import { createGameEndpoint } from "./create-game";
import { deleteGameEndpoint } from "./delete-game";
import { deletePrizeEndpoint } from "./delete-prize";
import { gameStatsEndpoint } from "./game-stats";
import { getGameAdminEndpoint } from "./get-game";
import { listGamesEndpoint } from "./list-games";
import { listPrizesEndpoint } from "./list-prizes";
import { playHistoryEndpoint } from "./play-history";
import { updateGameEndpoint } from "./update-game";
import { updatePrizeEndpoint } from "./update-prize";

export const adminEndpoints = {
	"/admin/gamification/games": listGamesEndpoint,
	"/admin/gamification/games/create": createGameEndpoint,
	"/admin/gamification/games/:id": getGameAdminEndpoint,
	"/admin/gamification/games/:id/update": updateGameEndpoint,
	"/admin/gamification/games/:id/delete": deleteGameEndpoint,
	"/admin/gamification/games/:id/prizes": listPrizesEndpoint,
	"/admin/gamification/games/:id/prizes/add": addPrizeEndpoint,
	"/admin/gamification/prizes/:id/update": updatePrizeEndpoint,
	"/admin/gamification/prizes/:id/delete": deletePrizeEndpoint,
	"/admin/gamification/games/:id/plays": playHistoryEndpoint,
	"/admin/gamification/games/:id/stats": gameStatsEndpoint,
};
