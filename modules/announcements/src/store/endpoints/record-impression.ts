import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AnnouncementsController } from "../../service";

export const recordImpression = createStoreEndpoint(
	"/announcements/:id/impression",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		await controller.recordImpression(ctx.params.id);

		return { success: true };
	},
);
