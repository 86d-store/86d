import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { resolveOrderCustomerContext } from "./customer-context";

export const listMyOrders = createStoreEndpoint(
	"/orders/me",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
		}),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const { page, limit } = ctx.query;
		const offset = (page - 1) * limit;

		const { orders, total } = await customerContext.controller.listForCustomer(
			customerContext.customerId,
			{
				limit,
				offset,
			},
		);

		return {
			orders,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
