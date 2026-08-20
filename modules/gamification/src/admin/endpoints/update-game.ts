import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { GamificationController } from "../../service";

export const updateGameEndpoint = createAdminEndpoint(
	"/admin/gamification/games/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			type: z.enum(["wheel", "scratch", "slot"]).optional(),
			isActive: z.boolean().optional(),
			requireEmail: z.boolean().optional(),
			requireNewsletterOptIn: z.boolean().optional(),
			maxPlaysPerUser: z.number().int().min(-1).optional(),
			cooldownMinutes: z.number().int().min(0).optional(),
			startDate: z.coerce.date().optional(),
			endDate: z.coerce.date().optional(),
			settings: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const game = await controller.updateGame(ctx.params.id, {
			name: ctx.body.name,
			description: ctx.body.description,
			type: ctx.body.type,
			isActive: ctx.body.isActive,
			requireEmail: ctx.body.requireEmail,
			requireNewsletterOptIn: ctx.body.requireNewsletterOptIn,
			maxPlaysPerUser: ctx.body.maxPlaysPerUser,
			cooldownMinutes: ctx.body.cooldownMinutes,
			startDate: ctx.body.startDate,
			endDate: ctx.body.endDate,
			settings: ctx.body.settings,
		});
		if (!game) return { game: null, error: "Game not found" };
		return { game };
	},
);
