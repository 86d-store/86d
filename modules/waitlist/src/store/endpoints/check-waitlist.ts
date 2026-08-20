import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WaitlistController } from "../../service";

export const checkWaitlist = createStoreEndpoint(
	"/waitlist/check/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string().min(1).max(200),
		}),
		query: z.object({
			email: z.string().email().max(320),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.waitlist as WaitlistController;
		const subscribed = await controller.isSubscribed(
			ctx.query.email,
			ctx.params.productId,
		);
		const count = await controller.countByProduct(ctx.params.productId);
		return { subscribed, waitingCount: count };
	},
);
