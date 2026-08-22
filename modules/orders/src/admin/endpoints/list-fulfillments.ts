import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import {
	type OwnerFulfillmentController,
	projectOrderFulfillmentStatus,
	projectOwnerFulfillments,
} from "../../fulfillment-projection";
import type { OrderController } from "../../service";

export const adminListFulfillments = createAdminEndpoint(
	"/admin/orders/:id/fulfillments",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;

		const order = await controller.getById(ctx.params.id);
		if (!order) {
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
			controller.getItems(ctx.params.id),
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
