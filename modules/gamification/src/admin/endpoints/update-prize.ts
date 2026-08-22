import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GamificationController } from "../../service";

export const updatePrizeEndpoint = createAdminEndpoint(
	"/admin/gamification/prizes/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			type: z
				.enum([
					"discount-percent",
					"discount-fixed",
					"free-shipping",
					"free-product",
					"custom",
				])
				.optional(),
			value: z.string().min(1).max(100).optional(),
			probability: z.number().min(0).max(100).optional(),
			maxWins: z.number().int().min(-1).optional(),
			discountCode: z.string().max(100).optional(),
			productId: z.string().max(200).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.gamification as GamificationController;
		const prize = await controller.updatePrize(ctx.params.id, {
			name: ctx.body.name,
			description: ctx.body.description,
			type: ctx.body.type,
			value: ctx.body.value,
			probability: ctx.body.probability,
			maxWins: ctx.body.maxWins,
			discountCode: ctx.body.discountCode,
			productId: ctx.body.productId,
			isActive: ctx.body.isActive,
		});
		if (!prize) return { prize: null, error: "Prize not found" };
		return { prize };
	},
);
