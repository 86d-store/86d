import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GamificationController } from "../../service";

export const getGameEndpoint = createStoreEndpoint(
	"/gamification/games/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const game = await controller.getGame(ctx.params.id);
		if (!game) return { game: null };
		// Public info only — strip probabilities by not including prizes
		return {
			game: {
				id: game.id,
				name: game.name,
				description: game.description,
				type: game.type,
				isActive: game.isActive,
				requireEmail: game.requireEmail,
				requireNewsletterOptIn: game.requireNewsletterOptIn,
				settings: game.settings,
				startDate: game.startDate,
				endDate: game.endDate,
			},
		};
	},
);
