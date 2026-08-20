import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { gamificationStorage } from "./schema";
import { createGamificationController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	CanPlayResult,
	Game,
	GameStats,
	GameType,
	GamificationController,
	Play,
	Prize,
	PrizeType,
} from "./service";

export interface GamificationOptions extends ModuleConfig {
	/** Default game type (default: "wheel") */
	defaultGameType?: string;
	/** Require email to play (default: "true") */
	requireEmail?: string;
	/** Max plays per day (default: "1") */
	maxPlaysPerDay?: string;
	/** Cooldown in minutes (default: "1440") */
	cooldownMinutes?: string;
}

export default function gamification(options?: GamificationOptions): Module {
	return {
		id: "gamification",
		version: "0.0.1",
		storage: gamificationStorage,
		exports: {
			read: ["gameType", "gameIsActive"],
		},
		events: {
			emits: [
				"game.played",
				"game.won",
				"game.lost",
				"prize.redeemed",
				"game.created",
				"game.updated",
				"game.deleted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createGamificationController(ctx.data, ctx.events);
			return { controllers: { gamification: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [{ path: "/play/:gameId", component: "GameWidget" }],
		},
		admin: {
			pages: [
				{
					path: "/admin/gamification",
					component: "GamificationAdmin",
					label: "Gamification",
					icon: "Sparkle",
					group: "Marketing",
				},
				{
					path: "/admin/gamification/games",
					component: "GameList",
					label: "Games",
					icon: "Dice",
					group: "Marketing",
				},
			],
		},
		options,
	};
}
