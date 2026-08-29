import { createAdminEndpoint } from "@86d-app/core/api";
import type { GiftCardController } from "../../service";
import { GiftCardDataUnavailableError } from "../../service-impl";

export const getGiftCardStats = createAdminEndpoint(
	"/admin/gift-cards/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		try {
			const stats = await controller.getStats();
			return { stats };
		} catch (error) {
			if (error instanceof GiftCardDataUnavailableError) {
				return { error: "Gift card summaries are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
