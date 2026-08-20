import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EbayController } from "../../service";

export const getListingEndpoint = createAdminEndpoint(
	"/admin/ebay/listings/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const listing = await controller.getListing(ctx.params.id);
		return { listing };
	},
);
