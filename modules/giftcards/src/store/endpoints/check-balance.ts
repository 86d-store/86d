import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { GiftCardController } from "../../service";

export const checkGiftCardBalance = createStoreEndpoint(
	"/gift-cards/check",
	{
		method: "GET",
		query: z.object({
			code: z.string().min(1).max(50).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const result = await controller.checkBalance(ctx.query.code);

		if (!result) {
			return { error: "Gift card not found", status: 404 };
		}

		return {
			balance: result.balance,
			currency: result.currency,
			status: result.status,
		};
	},
);
