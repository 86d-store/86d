import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GamificationController } from "../../service";

export const gameStatsEndpoint = createAdminEndpoint(
	"/admin/gamification/games/:id/stats",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const stats = await controller.getGameStats(ctx.params.id);
		return { stats };
	},
);
