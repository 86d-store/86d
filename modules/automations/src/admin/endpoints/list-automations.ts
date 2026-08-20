import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AutomationsController } from "../../service";

export const listAutomations = createAdminEndpoint(
	"/admin/automations",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "paused", "draft"]).optional(),
			triggerEvent: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		return controller.list({
			status: ctx.query.status,
			triggerEvent: ctx.query.triggerEvent,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
	},
);
