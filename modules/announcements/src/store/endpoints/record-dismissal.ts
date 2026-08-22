import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnnouncementsController } from "../../service";

export const recordDismissal = createStoreEndpoint(
	"/announcements/:id/dismiss",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		await controller.recordDismissal(ctx.params.id);

		return { success: true };
	},
);
