import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const createPriceList = createAdminEndpoint(
	"/admin/price-lists/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			currency: z.string().max(3).optional(),
			priority: z.number().int().min(0).optional(),
			status: z.enum(["active", "inactive", "scheduled"]).optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
			customerGroupId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const existing = await controller.getPriceListBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A price list with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createPriceList>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.currency != null) params.currency = ctx.body.currency;
		if (ctx.body.priority != null) params.priority = ctx.body.priority;
		if (ctx.body.status != null) params.status = ctx.body.status;
		if (ctx.body.startsAt != null) params.startsAt = ctx.body.startsAt;
		if (ctx.body.endsAt != null) params.endsAt = ctx.body.endsAt;
		if (ctx.body.customerGroupId != null)
			params.customerGroupId = ctx.body.customerGroupId;

		const priceList = await controller.createPriceList(params);

		return { priceList };
	},
);
