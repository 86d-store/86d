import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { notificationDeliveryDurabilityRequired } from "./delivery-containment";

export const batchSendEndpoint = createAdminEndpoint(
	"/admin/notifications/batch-send",
	{
		method: "POST",
		body: z.object({
			customerIds: z.array(z.string()).min(1).max(500),
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
			title: z.string().max(500).transform(sanitizeText),
			body: z.string().max(5000).transform(sanitizeText),
			actionUrl: z.string().url().max(2000).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		if (ctx.body.channel && ctx.body.channel !== "in_app") {
			return notificationDeliveryDurabilityRequired();
		}

		const controller = ctx.context.controllers.notifications;
		const result = await controller.batchSend({
			customerIds: ctx.body.customerIds,
			type: ctx.body.type,
			channel: "in_app",
			priority: ctx.body.priority,
			title: ctx.body.title,
			body: ctx.body.body,
			actionUrl: ctx.body.actionUrl,
			metadata: ctx.body.metadata,
		});
		return result;
	},
);
