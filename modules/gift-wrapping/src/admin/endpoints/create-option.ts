import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const createOption = createAdminEndpoint(
	"/admin/gift-wrapping/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			description: z.string().max(1000).optional(),
			priceInCents: z.number().int().min(0),
			imageUrl: z.string().url().optional(),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const params: import("../../service").CreateWrapOptionParams = {
			name: ctx.body.name,
			priceInCents: ctx.body.priceInCents,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.imageUrl != null) params.imageUrl = ctx.body.imageUrl;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const option = await controller.createOption(params);
		return { option };
	},
);
