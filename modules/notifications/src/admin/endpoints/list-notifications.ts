import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	NotificationPriority,
	NotificationsController,
	NotificationType,
} from "../../service";

export const listNotificationsEndpoint = createAdminEndpoint(
	"/admin/notifications",
	{
		method: "GET",
		query: z.object({
			customerId: z.string().optional(),
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
			priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
			read: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.list({
			customerId: ctx.query.customerId,
			type: ctx.query.type as NotificationType | undefined,
			priority: ctx.query.priority as NotificationPriority | undefined,
			read: ctx.query.read,
		});
		const total = all.length;
		const notifications = all.slice(skip, skip + limit);
		return { notifications, total };
	},
);
