import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { NotificationsController } from "../../service";

export const updateTemplateEndpoint = createAdminEndpoint(
	"/admin/notifications/templates/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().max(200).transform(sanitizeText).optional(),
			type: z
				.enum([
					"info",
					"success",
					"warning",
					"error",
					"order",
					"shipping",
					"promotion",
				])
				.optional(),
			channel: z.enum(["in_app", "email", "both"]).optional(),
			priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
			titleTemplate: z.string().max(500).transform(sanitizeText).optional(),
			bodyTemplate: z.string().max(5000).transform(sanitizeText).optional(),
			actionUrlTemplate: z.string().max(2000).optional(),
			variables: z.array(z.string().max(50)).max(20).optional(),
			active: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const template = await controller.updateTemplate(ctx.params.id, {
			name: ctx.body.name,
			type: ctx.body.type,
			channel: ctx.body.channel,
			priority: ctx.body.priority,
			titleTemplate: ctx.body.titleTemplate,
			bodyTemplate: ctx.body.bodyTemplate,
			actionUrlTemplate: ctx.body.actionUrlTemplate,
			variables: ctx.body.variables,
			active: ctx.body.active,
		});
		if (!template) {
			return { error: "Template not found", status: 404 };
		}
		return { template };
	},
);
