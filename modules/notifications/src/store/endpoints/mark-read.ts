import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const markReadEndpoint = createStoreEndpoint(
	"/notifications/:id/read",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;

		// Verify ownership before marking read
		const existing = await controller.get(ctx.params.id);
		if (!existing || existing.customerId !== customerId) {
			return { error: "Notification not found", status: 404 };
		}

		const notification = await controller.markRead(ctx.params.id);
		return { notification };
	},
);
