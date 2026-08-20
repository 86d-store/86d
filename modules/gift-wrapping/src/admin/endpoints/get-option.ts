import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const getOption = createAdminEndpoint(
	"/admin/gift-wrapping/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const option = await controller.getOption(ctx.params.id);
		if (!option) {
			return { error: "Wrap option not found", status: 404 };
		}
		return { option };
	},
);
