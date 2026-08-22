import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FulfillmentController } from "../../service";

export const listFulfillments = createAdminEndpoint(
	"/admin/fulfillment",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["pending", "processing", "shipped", "delivered", "cancelled"])
				.optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
			offset: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillments = await controller.listFulfillments({
			status: ctx.query.status,
			limit: ctx.query.limit,
			offset: ctx.query.offset,
		});
		return { fulfillments };
	},
);
