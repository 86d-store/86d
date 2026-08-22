import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GamificationController } from "../../service";

export const canPlayEndpoint = createStoreEndpoint(
	"/gamification/games/:id/can-play",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
		query: z.object({
			// email only accepted for anonymous (unauthenticated) checks
			email: z.string().email().max(320).optional(),
			ipAddress: z.string().max(45).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;

		// Derive identity from session — never trust client-provided customerId
		const customerId = ctx.context.session?.user.id;
		// For authenticated users, use session email only; for anonymous, accept query email
		const email = customerId
			? ctx.context.session?.user.email
			: ctx.query.email;

		const result = await controller.canPlay(ctx.params.id, {
			email,
			customerId,
			ipAddress: ctx.query.ipAddress,
		});
		return result;
	},
);
