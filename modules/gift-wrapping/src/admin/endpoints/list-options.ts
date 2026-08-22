import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftWrappingController, ListOptionsParams } from "../../service";

export const listOptions = createAdminEndpoint(
	"/admin/gift-wrapping",
	{
		method: "GET",
		query: z.object({
			active: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const params: ListOptionsParams = {
			take: ctx.query.take ?? 50,
		};
		if (ctx.query.active !== undefined) params.active = ctx.query.active;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;

		const options = await controller.listOptions(params);
		return { options };
	},
);
