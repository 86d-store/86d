import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/quotes/stats",
	{
		method: "GET",
		query: z.object({}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const stats = await controller.getStats();
		return { stats };
	},
);
