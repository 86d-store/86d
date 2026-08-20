import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftCardController } from "../../service";

export const deleteGiftCard = createAdminEndpoint(
	"/admin/gift-cards/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const deleted = await controller.delete(ctx.params.id);
		if (!deleted) {
			return { error: "Gift card not found", status: 404 };
		}
		return { deleted };
	},
);
