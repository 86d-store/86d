import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StorePickupController } from "../../service";

export const orderPickup = createStoreEndpoint(
	"/store-pickup/order/:orderId",
	{
		method: "GET",
		params: z.object({
			orderId: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const pickup = await controller.getOrderPickup(ctx.params.orderId);
		if (!pickup) {
			return { error: "No active pickup found for this order", status: 404 };
		}

		if (pickup.customerId && pickup.customerId !== userId) {
			return { error: "No active pickup found for this order", status: 404 };
		}

		return { pickup };
	},
);
