import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MediaController } from "../../service";

export const deleteFolderEndpoint = createAdminEndpoint(
	"/admin/media/folders/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const deleted = await controller.deleteFolder(ctx.params.id);
		return { deleted };
	},
);
