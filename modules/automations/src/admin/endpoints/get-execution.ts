import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

export const getExecution = createAdminEndpoint(
	"/admin/automations/executions/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		const execution = await controller.getExecution(ctx.params.id);
		if (!execution) {
			return { error: "Execution not found", status: 404 };
		}
		return { execution };
	},
);
