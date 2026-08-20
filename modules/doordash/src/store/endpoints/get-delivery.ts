import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DoordashController } from "../../service";

export const getDeliveryEndpoint = createStoreEndpoint(
	"/doordash/deliveries/:id",
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

		const controller = ctx.context.controllers.doordash as DoordashController;
		const delivery = await controller.getDelivery(ctx.params.id);
		if (!delivery) {
			return { error: "Delivery not found", status: 404 };
		}
		return { delivery };
	},
);
