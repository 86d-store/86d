import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import {
	type OwnerFulfillmentController,
	projectOrderFulfillmentStatus,
	projectOwnerFulfillments,
} from "../../fulfillment-projection";
import { resolveOrderCustomerContext } from "./customer-context";

export const getMyOrderFulfillments = createStoreEndpoint(
	"/orders/me/:id/fulfillments",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const order = await customerContext.controller.getById(ctx.params.id);
		if (!order || order.customerId !== customerContext.customerId) {
			return { error: "Order not found", status: 404 };
		}

		const fulfillmentController = ctx.context.controllers.fulfillment as
			| OwnerFulfillmentController
			| undefined;
		if (!fulfillmentController?.listByOrder) {
			return {
				code: "FULFILLMENT_OWNER_OPERATION_REQUIRED",
				error: "Fulfillment reads belong to the standalone Fulfillment module.",
				status: 503,
			};
		}

		const [ownerFulfillments, orderItems] = await Promise.all([
			fulfillmentController.listByOrder(ctx.params.id),
			customerContext.controller.getItems(ctx.params.id),
		]);

		return {
			fulfillments: projectOwnerFulfillments(ownerFulfillments),
			fulfillmentStatus: projectOrderFulfillmentStatus(
				orderItems,
				ownerFulfillments,
			),
		};
	},
);
