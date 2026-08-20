import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AmazonController } from "../../service";

export const pushListingEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/:id/push",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const listing = await controller.pushListing(ctx.params.id);
		return { listing };
	},
);
