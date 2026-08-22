import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MediaController } from "../../service";

export const deleteAssetEndpoint = createAdminEndpoint(
	"/admin/media/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const deleted = await controller.deleteAsset(ctx.params.id);
		return { deleted };
	},
);
