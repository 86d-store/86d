import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftCardController } from "../../service";

export const listGiftCards = createAdminEndpoint(
	"/admin/gift-cards",
	{
		method: "GET",
		query: z.object({
			status: z.string().optional(),
			customerId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.list({
			status: ctx.query.status,
			customerId: ctx.query.customerId,
		});
		const total = all.length;
		const cards = all.slice(skip, skip + take);
		return { cards, total };
	},
);
