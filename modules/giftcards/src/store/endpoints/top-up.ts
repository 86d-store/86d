import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const topUpGiftCard = createStoreEndpoint(
	"/gift-cards/top-up",
	{
		method: "POST",
		body: z.object({
			giftCardId: z.string().max(200),
			amount: z.number().positive().max(10000),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const result = await controller.topUp({
			giftCardId: ctx.body.giftCardId,
			customerId: session.user.id,
			amount: ctx.body.amount,
		});

		if (!result) {
			return {
				error:
					"Gift card not found, not owned by you, disabled, or invalid amount",
				status: 400,
			};
		}

		return {
			newBalance: result.giftCard.currentBalance,
			currency: result.giftCard.currency,
			amountAdded: result.transaction.amount,
		};
	},
);
