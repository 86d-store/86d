import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const updateFlashSale = createAdminEndpoint(
	"/admin/flash-sales/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			status: z.enum(["draft", "scheduled", "active", "ended"]).optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const params: Parameters<typeof controller.updateFlashSale>[1] = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.slug != null) params.slug = ctx.body.slug;
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.status != null) params.status = ctx.body.status;
		if (ctx.body.startsAt != null) params.startsAt = ctx.body.startsAt;
		if (ctx.body.endsAt != null) params.endsAt = ctx.body.endsAt;

		const sale = await controller.updateFlashSale(ctx.params.id, params);
		if (!sale) {
			return { error: "Flash sale not found", status: 404 };
		}

		return { sale };
	},
);
