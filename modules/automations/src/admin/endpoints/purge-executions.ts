import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

export const purgeExecutions = createAdminEndpoint(
	"/admin/automations/executions/purge",
	{
		method: "POST",
		body: z.object({
			olderThanDays: z.number().int().min(1).max(365),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - ctx.body.olderThanDays);
		const deleted = await controller.purgeExecutions(cutoff);
		return { deleted };
	},
);
