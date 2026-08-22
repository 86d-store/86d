import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ToastController } from "../../service";

export const deleteMenuMappingEndpoint = createAdminEndpoint(
	"/admin/toast/menu-mappings/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.toast as ToastController;
		const deleted = await controller.deleteMenuMapping(ctx.params.id);
		return { deleted };
	},
);
