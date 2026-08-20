import { createStoreEndpoint } from "@86d-app/core/api";
import type { ShippingController } from "../../service";

export const listMethods = createStoreEndpoint(
	"/shipping/methods",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const methods = await controller.listMethods({ activeOnly: true });
		const sorted = methods.sort((a, b) => a.sortOrder - b.sortOrder);
		return { methods: sorted };
	},
);
