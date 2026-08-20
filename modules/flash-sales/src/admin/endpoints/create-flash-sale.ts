import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const createFlashSale = createAdminEndpoint(
	"/admin/flash-sales/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			status: z.enum(["draft", "scheduled", "active", "ended"]).optional(),
			startsAt: z.coerce.date(),
			endsAt: z.coerce.date(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		if (ctx.body.endsAt <= ctx.body.startsAt) {
			return { error: "End date must be after start date", status: 400 };
		}

		const existing = await controller.getFlashSaleBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A flash sale with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createFlashSale>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
			startsAt: ctx.body.startsAt,
			endsAt: ctx.body.endsAt,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.status != null) params.status = ctx.body.status;

		const sale = await controller.createFlashSale(params);

		return { sale };
	},
);
