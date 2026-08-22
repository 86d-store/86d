import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const listMyNotificationsEndpoint = createStoreEndpoint(
	"/notifications",
	{
		method: "GET",
		query: z.object({
			read: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const limit = ctx.query.limit ?? 25;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const notifications = await controller.list({
			customerId,
			read: ctx.query.read,
			take: limit,
			skip,
		});
		return { notifications, total: notifications.length };
	},
);
