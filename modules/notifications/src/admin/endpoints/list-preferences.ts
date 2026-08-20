import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NotificationsController } from "../../service";

export const listPreferencesEndpoint = createAdminEndpoint(
	"/admin/notifications/preferences",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().min(1).max(100).optional(),
			offset: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const preferences = await controller.listPreferences({
			take: ctx.query.limit,
			skip: ctx.query.offset,
		});
		return { preferences };
	},
);
