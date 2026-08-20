import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const updateOption = createAdminEndpoint(
	"/admin/gift-wrapping/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			description: z.string().max(1000).optional(),
			priceInCents: z.number().int().min(0).optional(),
			imageUrl: z.string().url().optional(),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const params: import("../../service").UpdateWrapOptionParams = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.priceInCents != null)
			params.priceInCents = ctx.body.priceInCents;
		if (ctx.body.imageUrl != null) params.imageUrl = ctx.body.imageUrl;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const option = await controller.updateOption(ctx.params.id, params);
		if (!option) {
			return { error: "Wrap option not found", status: 404 };
		}
		return { option };
	},
);
