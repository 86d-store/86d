import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MediaController } from "../../service";

export const bulkDeleteEndpoint = createAdminEndpoint(
	"/admin/media/bulk-delete",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const deleted = await controller.bulkDelete(ctx.body.ids);
		return { deleted };
	},
);
