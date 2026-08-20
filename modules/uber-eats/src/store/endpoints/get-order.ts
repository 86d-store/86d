import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { UberEatsController } from "../../service";

export const getOrderEndpoint = createStoreEndpoint(
	"/uber-eats/orders/:id",
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

		const controller = ctx.context.controllers[
			"uber-eats"
		] as UberEatsController;
		const order = await controller.getOrder(ctx.params.id);
		if (!order) {
			return { error: "Order not found", status: 404 };
		}
		return { order };
	},
);
