import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TippingController } from "../../service";

export const createPayout = createAdminEndpoint(
	"/admin/tipping/payouts",
	{
		method: "POST",
		body: z.object({
			recipientId: z.string().min(1).max(200),
			recipientType: z.string().min(1).max(50),
			amount: z.number().positive().max(10000000),
			tipCount: z.number().int().min(0).max(100000),
			periodStart: z.string().min(1).max(50),
			periodEnd: z.string().min(1).max(50),
			reference: z.string().max(500).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const payout = await controller.createPayout({
			recipientId: ctx.body.recipientId,
			recipientType: ctx.body.recipientType,
			amount: ctx.body.amount,
			tipCount: ctx.body.tipCount,
			periodStart: new Date(ctx.body.periodStart),
			periodEnd: new Date(ctx.body.periodEnd),
			reference: ctx.body.reference,
		});
		return { payout };
	},
);
