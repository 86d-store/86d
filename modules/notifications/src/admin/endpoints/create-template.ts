import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const createTemplateEndpoint = createAdminEndpoint(
	"/admin/notifications/templates/create",
	{
		method: "POST",
		body: z.object({
			slug: z
				.string()
				.max(100)
				.regex(
					/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
					"Slug must be lowercase alphanumeric with hyphens",
				),
			name: z.string().max(200).transform(sanitizeText),
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
			titleTemplate: z.string().max(500).transform(sanitizeText),
			bodyTemplate: z.string().max(5000).transform(sanitizeText),
			actionUrlTemplate: z.string().max(2000).optional(),
			variables: z.array(z.string().max(50)).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;

		// Check for duplicate slug
		const existing = await controller.getTemplateBySlug(ctx.body.slug);
		if (existing) {
			return { error: "A template with this slug already exists", status: 409 };
		}

		const template = await controller.createTemplate({
			slug: ctx.body.slug,
			name: ctx.body.name,
			type: ctx.body.type,
			channel: ctx.body.channel,
			priority: ctx.body.priority,
			titleTemplate: ctx.body.titleTemplate,
			bodyTemplate: ctx.body.bodyTemplate,
			actionUrlTemplate: ctx.body.actionUrlTemplate,
			variables: ctx.body.variables,
		});
		return { template };
	},
);
