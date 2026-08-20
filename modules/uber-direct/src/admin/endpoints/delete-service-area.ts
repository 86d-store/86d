import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { UberDirectController } from "../../service";

export const deleteServiceAreaEndpoint = createAdminEndpoint(
	"/admin/uber-direct/service-areas/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const deleted = await controller.deleteServiceArea(ctx.params.id);
		if (!deleted) return { error: "Service area not found", status: 404 };
		return { success: true };
	},
);
