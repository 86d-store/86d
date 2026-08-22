import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const getTemplateEndpoint = createAdminEndpoint(
	"/admin/notifications/templates/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const template = await controller.getTemplate(ctx.params.id);
		if (!template) {
			return { error: "Template not found", status: 404 };
		}
		return { template };
	},
);
