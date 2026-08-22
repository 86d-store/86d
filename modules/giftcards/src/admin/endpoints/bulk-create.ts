import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const bulkCreateGiftCards = createAdminEndpoint(
	"/admin/gift-cards/bulk-create",
	{
		method: "POST",
		body: z.object({
			count: z.number().int().min(1).max(100),
			initialBalance: z.number().positive().max(10000),
			currency: z.string().max(3).optional(),
			expiresAt: z.string().max(50).optional(),
			note: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const cards = await controller.bulkCreate({
			count: ctx.body.count,
			initialBalance: ctx.body.initialBalance,
			currency: ctx.body.currency,
			expiresAt: ctx.body.expiresAt,
			note: ctx.body.note,
		});
		return {
			cards: cards.map((c) => ({
				id: c.id,
				code: c.code,
				initialBalance: c.initialBalance,
				currency: c.currency,
			})),
			count: cards.length,
		};
	},
);
