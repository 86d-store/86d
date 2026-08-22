import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MediaController } from "../../service";

export const moveAssetsEndpoint = createAdminEndpoint(
	"/admin/media/move",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
			folder: z.string().max(200).nullable(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const moved = await controller.moveAssets(ctx.body.ids, ctx.body.folder);
		return { moved };
	},
);
