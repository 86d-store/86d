import { createAdminEndpoint } from "@86d-app/core/api";
import type { AmazonController } from "../../service";

export const syncListingsEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const result = await controller.syncListings();
		return result;
	},
);
