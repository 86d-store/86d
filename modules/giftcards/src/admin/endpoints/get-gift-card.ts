import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const getGiftCard = createAdminEndpoint(
	"/admin/gift-cards/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1).max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const card = await controller.get(ctx.params.id);
		if (!card) {
			return { error: "Gift card not found", status: 404 };
		}
		return { card };
	},
);
