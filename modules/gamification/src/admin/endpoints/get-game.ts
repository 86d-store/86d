import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GamificationController } from "../../service";

export const getGameAdminEndpoint = createAdminEndpoint(
	"/admin/gamification/games/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const game = await controller.getGame(ctx.params.id);
		if (!game) return { game: null };
		const prizes = await controller.listPrizes(ctx.params.id);
		return { game, prizes };
	},
);
