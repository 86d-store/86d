import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GameType, GamificationController } from "../../service";

export const listGamesEndpoint = createAdminEndpoint(
	"/admin/gamification/games",
	{
		method: "GET",
		query: z.object({
			type: z.enum(["wheel", "scratch", "slot"]).optional(),
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
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
		const all = await controller.listGames({
			type: ctx.query.type as GameType | undefined,
			isActive: ctx.query.isActive,
		});
		const total = all.length;
		const games = all.slice(skip, skip + limit);
		return { games, total };
	},
);
