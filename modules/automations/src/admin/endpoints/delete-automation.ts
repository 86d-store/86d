import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

export const deleteAutomation = createAdminEndpoint(
	"/admin/automations/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		await controller.delete(ctx.params.id);
		return { success: true };
	},
);
