import { createAdminEndpoint } from "@86d-store/core/api";
import type { WishController } from "../../service";

export const pendingShipmentsEndpoint = createAdminEndpoint(
	"/admin/wish/orders/pending",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const orders = await controller.getPendingShipments();
		return { orders };
	},
);
