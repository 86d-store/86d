import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DoordashController } from "../../service";

export const deleteZoneEndpoint = createAdminEndpoint(
	"/admin/doordash/zones/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const deleted = await controller.deleteZone(ctx.params.id);
		return { deleted };
	},
);
