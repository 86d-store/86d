import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GamificationController } from "../../service";

export const deletePrizeEndpoint = createAdminEndpoint(
	"/admin/gamification/prizes/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const deleted = await controller.removePrize(ctx.params.id);
		return { deleted };
	},
);
