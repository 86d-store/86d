import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftCardController } from "../../service";
import { GiftCardDataUnavailableError } from "../../service-impl";

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
		try {
			const result = await controller.checkBalance(ctx.query.code);

			if (!result) {
				return { error: "Gift card not found", status: 404 };
			}

			return {
				balance: result.balance,
				currency: result.currency,
				status: result.status,
			};
		} catch (error) {
			if (error instanceof GiftCardDataUnavailableError) {
				return { error: "Gift card balance is unavailable", status: 503 };
			}
			throw error;
		}
	},
);
