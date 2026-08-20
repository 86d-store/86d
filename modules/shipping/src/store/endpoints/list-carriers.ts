import { createStoreEndpoint } from "@86d-app/core/api";
import type { ShippingController } from "../../service";

export const listCarriers = createStoreEndpoint(
	"/shipping/carriers",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const carriers = await controller.listCarriers({ activeOnly: true });
		return { carriers };
	},
);
