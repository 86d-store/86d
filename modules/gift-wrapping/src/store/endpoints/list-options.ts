import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftWrappingController } from "../../service";

export const listOptions = createStoreEndpoint(
	"/gift-wrapping/options",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const params: import("../../service").ListOptionsParams = {
			active: true,
			take: ctx.query.take ?? 20,
		};
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const options = await controller.listOptions(params);
		return { options };
	},
);
