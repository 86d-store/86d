import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { EtsyController } from "../../service";

export const renewListingEndpoint = createAdminEndpoint(
	"/admin/etsy/listings/:id/renew",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const listing = await controller.renewListing(ctx.params.id);
		return { listing };
	},
);
