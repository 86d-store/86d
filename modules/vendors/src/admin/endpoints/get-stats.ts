import { createAdminEndpoint } from "@86d-store/core/api";
import type { VendorController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/vendors/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const stats = await controller.getStats();

		return { stats };
	},
);
