import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PaymentController, PaymentIntentStatus } from "../../service";

export const listIntents = createAdminEndpoint(
	"/admin/payments",
	{
		method: "GET",
		query: z.object({
			customerId: z.string().optional(),
			status: z
				.enum([
					"pending",
					"processing",
					"succeeded",
					"failed",
					"cancelled",
					"refunded",
				])
				.optional(),
			orderId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		const take = ctx.query.take ?? 20;
		const skip = ctx.query.skip ?? 0;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listIntents({
			customerId: ctx.query.customerId,
			status: ctx.query.status as PaymentIntentStatus | undefined,
			orderId: ctx.query.orderId,
		});
		const total = all.length;
		const intents = all.slice(skip, skip + take);
		return { intents, total };
	},
);
