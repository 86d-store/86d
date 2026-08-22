import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const deleteTemplateEndpoint = createAdminEndpoint(
	"/admin/notifications/templates/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const deleted = await controller.deleteTemplate(ctx.params.id);
		if (!deleted) {
			return { error: "Template not found", status: 404 };
		}
		return { success: true };
	},
);
