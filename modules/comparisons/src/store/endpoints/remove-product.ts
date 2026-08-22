import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const removeProduct = createStoreEndpoint(
	"/comparisons/remove",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;
		const customerId = ctx.context.session?.user.id;

		const removed = await controller.removeProduct({
			customerId,
			sessionId: !customerId ? ctx.body.sessionId : undefined,
			productId: ctx.body.productId,
		});

		return { removed };
	},
);
