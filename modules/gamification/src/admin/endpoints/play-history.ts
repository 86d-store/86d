import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GamificationController } from "../../service";

export const playHistoryEndpoint = createAdminEndpoint(
	"/admin/gamification/games/:id/plays",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
		query: z.object({
			email: z.string().optional(),
			customerId: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.getPlayHistory({
			gameId: ctx.params.id,
			email: ctx.query.email,
			customerId: ctx.query.customerId,
		});
		const total = all.length;
		const plays = all.slice(skip, skip + limit);
		return { plays, total };
	},
);
