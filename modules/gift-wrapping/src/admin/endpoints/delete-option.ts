import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const deleteOption = createAdminEndpoint(
	"/admin/gift-wrapping/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const deleted = await controller.deleteOption(ctx.params.id);
		return { deleted };
	},
);
