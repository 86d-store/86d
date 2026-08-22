import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnnouncementsController } from "../../service";

export const listAnnouncements = createAdminEndpoint(
	"/admin/announcements",
	{
		method: "GET",
		query: z
			.object({
				active: z.string().optional(),
				type: z.enum(["bar", "banner", "popup"]).optional(),
				position: z.enum(["top", "bottom"]).optional(),
				limit: z.string().optional(),
				offset: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		const announcements = await controller.listAnnouncements({
			activeOnly: query.active === "true",
			type: query.type,
			position: query.position,
			limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
			offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
		});

		return { announcements };
	},
);
