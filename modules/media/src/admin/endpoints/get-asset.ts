import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MediaController } from "../../service";

export const adminGetAssetEndpoint = createAdminEndpoint(
	"/admin/media/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const asset = await controller.getAsset(ctx.params.id);
		return { asset };
	},
);
