import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FavorController } from "../../service";

export const getDelivery = createStoreEndpoint(
	"/favor/deliveries/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		const role = ctx.context.session?.user?.role;
		if (!userId || role !== "admin") {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.favor as FavorController;
		const delivery = await controller.getDelivery(ctx.params.id);

		if (!delivery) {
			return { error: "Delivery not found", status: 404 };
		}

		return {
			id: delivery.id,
			orderId: delivery.orderId,
			status: delivery.status,
			trackingUrl: delivery.trackingUrl,
			runnerName: delivery.runnerName,
			estimatedArrival: delivery.estimatedArrival,
			fee: delivery.fee,
			tip: delivery.tip,
		};
	},
);
