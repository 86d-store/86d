import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AmazonController } from "../../service";

export const getListingEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const listing = await controller.getListing(ctx.params.id);
		return { listing };
	},
);
