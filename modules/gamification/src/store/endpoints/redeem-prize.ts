import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GamificationController } from "../../service";

export const redeemPrizeEndpoint = createStoreEndpoint(
	"/gamification/plays/:id/redeem",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const play = await controller.redeemPrize(ctx.params.id);
		if (!play) return { play: null, error: "Play not found or not redeemable" };
		return { play };
	},
);
