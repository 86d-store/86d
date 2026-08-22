import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const listItems = createAdminEndpoint(
	"/admin/preorders/items",
	{
		method: "GET",
		query: z.object({
			campaignId: z.string().optional(),
			customerId: z.string().optional(),
			status: z
				.enum([
					"pending",
					"confirmed",
					"ready",
					"fulfilled",
					"cancelled",
					"refunded",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listPreorderItems({
			campaignId: ctx.query.campaignId,
			customerId: ctx.query.customerId,
			status: ctx.query.status,
		});
		const total = all.length;
		const items = all.slice(skip, skip + take);
		return { items, total };
	},
);
