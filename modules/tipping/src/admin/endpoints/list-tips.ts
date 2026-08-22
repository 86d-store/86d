import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TippingController } from "../../service";

export const listTips = createAdminEndpoint(
	"/admin/tipping/tips",
	{
		method: "GET",
		query: z.object({
			orderId: z.string().optional(),
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
		const all = await controller.listTips({
			orderId: ctx.query.orderId,
			recipientId: ctx.query.recipientId,
			status: ctx.query.status,
		});
		const total = all.length;
		const tips = all.slice(skip, skip + take);
		return { tips, total };
	},
);
