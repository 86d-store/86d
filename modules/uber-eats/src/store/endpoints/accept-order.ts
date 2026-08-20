import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { UberEatsController } from "../../service";

export const acceptOrderEndpoint = createStoreEndpoint(
	"/uber-eats/orders/:id/accept",
	{
		method: "POST",
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
		const order = await controller.acceptOrder(ctx.params.id);
		if (!order) {
			return { error: "Order not found", status: 404 };
		}
		return { order };
	},
);
