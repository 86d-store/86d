import { createAdminEndpoint } from "@86d-app/core/api";
import type { StoreLocatorController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/store-locator/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const stats = await controller.getStats();

		return stats;
	},
);
