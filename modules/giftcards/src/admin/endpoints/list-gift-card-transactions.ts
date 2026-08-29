import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftCardController } from "../../service";
import { GiftCardDataUnavailableError } from "../../service-impl";

export const listGiftCardTransactions = createAdminEndpoint(
	"/admin/gift-cards/:id/transactions",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1).max(200) }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		try {
			const card = await controller.get(ctx.params.id);
			if (!card) {
				return { error: "Gift card not found", status: 404 };
			}

			const transactions = await controller.listTransactions(ctx.params.id, {
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			});
			return { transactions, card };
		} catch (error) {
			if (error instanceof GiftCardDataUnavailableError) {
				return { error: "Gift card details are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
