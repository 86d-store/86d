import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { resolveOrderCustomerContext } from "./customer-context";

export const cancelMyOrder = createStoreEndpoint(
	"/orders/me/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const order = await customerContext.controller.getById(ctx.params.id);

		if (!order || order.customerId !== customerContext.customerId) {
			return { error: "Order not found", status: 404 };
		}

		return {
			code: "ORDER_CANCELLATION_OPERATION_UNAVAILABLE",
			error:
				"Order cancellation is unavailable until Payment, Inventory, tax, loyalty, and Shipping effects are coordinated durably.",
			status: 503,
		};
	},
);
