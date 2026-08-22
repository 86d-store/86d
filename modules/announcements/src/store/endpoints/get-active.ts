import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnnouncementsController } from "../../service";

export const getActive = createStoreEndpoint(
	"/announcements/active",
	{
		method: "GET",
		query: z
			.object({
				audience: z.enum(["all", "authenticated", "guest"]).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		const announcements = await controller.getActiveAnnouncements({
			audience: query.audience,
		});

		return { announcements };
	},
);
