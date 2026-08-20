import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EtsyController } from "../../service";

export const getListingEndpoint = createAdminEndpoint(
	"/admin/etsy/listings/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const listing = await controller.getListing(ctx.params.id);
		return { listing };
	},
);
