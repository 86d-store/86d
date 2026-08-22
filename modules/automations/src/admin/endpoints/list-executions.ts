import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

export const listExecutions = createAdminEndpoint(
	"/admin/automations/executions",
	{
		method: "GET",
		query: z.object({
			automationId: z.string().optional(),
			status: z
				.enum(["pending", "running", "completed", "failed", "skipped"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		return controller.listExecutions({
			automationId: ctx.query.automationId,
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
	},
);
