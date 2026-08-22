import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const creditGiftCard = createAdminEndpoint(
	"/admin/gift-cards/:id/credit",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			amount: z.number().positive().max(10000),
			note: z.string().max(1000).transform(sanitizeText).optional(),
			orderId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const result = await controller.credit(
			ctx.params.id,
			ctx.body.amount,
			ctx.body.note,
			ctx.body.orderId,
		);
		if (!result) {
			return { error: "Gift card not found", status: 404 };
		}
		return {
			transaction: result.transaction,
			card: result.giftCard,
		};
	},
);
