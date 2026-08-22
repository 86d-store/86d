import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const updatePriceList = createAdminEndpoint(
	"/admin/price-lists/:id/update",
	{
		method: "PUT",
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
			currency: z.string().max(3).nullable().optional(),
			priority: z.number().int().min(0).optional(),
			status: z.enum(["active", "inactive", "scheduled"]).optional(),
			startsAt: z.coerce.date().nullable().optional(),
			endsAt: z.coerce.date().nullable().optional(),
			customerGroupId: z.string().nullable().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		// Check slug uniqueness if changing slug
		if (ctx.body.slug != null) {
			const existing = await controller.getPriceListBySlug(ctx.body.slug);
			if (existing && existing.id !== ctx.params.id) {
				return {
					error: "A price list with this slug already exists",
					status: 400,
				};
			}
		}

		// Strip undefined keys to satisfy exactOptionalPropertyTypes
		const updates: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(ctx.body)) {
			if (value !== undefined) {
				updates[key] = value;
			}
		}

		const priceList = await controller.updatePriceList(
			ctx.params.id,
			updates as Parameters<PriceListController["updatePriceList"]>[1],
		);
		if (!priceList) {
			return { error: "Price list not found", status: 404 };
		}

		return { priceList };
	},
);
