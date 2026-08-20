import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GamificationController } from "../../service";

export const listPrizesEndpoint = createAdminEndpoint(
	"/admin/gamification/games/:id/prizes",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const prizes = await controller.listPrizes(ctx.params.id);
		return { prizes };
	},
);
