import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const listPriceLists = createAdminEndpoint(
	"/admin/price-lists",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "inactive", "scheduled"]).optional(),
			customerGroupId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const [priceLists, total] = await Promise.all([
			controller.listPriceLists({
				...(ctx.query.status != null && { status: ctx.query.status }),
				...(ctx.query.customerGroupId != null && {
					customerGroupId: ctx.query.customerGroupId,
				}),
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countPriceLists({
				...(ctx.query.status != null && { status: ctx.query.status }),
				...(ctx.query.customerGroupId != null && {
					customerGroupId: ctx.query.customerGroupId,
				}),
			}),
		]);

		return { priceLists, total };
	},
);
