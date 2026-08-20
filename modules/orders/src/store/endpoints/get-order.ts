import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { resolveOrderCustomerContext } from "./customer-context";

export const getMyOrder = createStoreEndpoint(
	"/orders/me/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const order = await customerContext.controller.getById(ctx.params.id);

		if (!order) {
			return { error: "Order not found", status: 404 };
		}

		// Ensure the order belongs to the requesting customer
		if (order.customerId !== customerContext.customerId) {
			return { error: "Order not found", status: 404 };
		}

		return { order };
	},
);
