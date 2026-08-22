import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TippingController } from "../../service";

export const listPayouts = createAdminEndpoint(
	"/admin/tipping/payouts/list",
	{
		method: "GET",
		query: z.object({
			recipientId: z.string().optional(),
			status: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listPayouts({
			recipientId: ctx.query.recipientId,
			status: ctx.query.status,
		});
		const total = all.length;
		const payouts = all.slice(skip, skip + take);
		return { payouts, total };
	},
);
