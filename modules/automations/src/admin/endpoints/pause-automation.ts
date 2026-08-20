import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AutomationsController } from "../../service";

export const pauseAutomation = createAdminEndpoint(
	"/admin/automations/:id/pause",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		try {
			const automation = await controller.pause(ctx.params.id);
			return { automation };
		} catch {
			return { error: "Automation not found", status: 404 };
		}
	},
);
