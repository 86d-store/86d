import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MediaController } from "../../service";

export const getAssetEndpoint = createStoreEndpoint(
	"/media/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const asset = await controller.getAsset(ctx.params.id);
		return { asset };
	},
);
