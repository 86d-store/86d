import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AmazonController } from "../../service";

export const deleteListingEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const deleted = await controller.deleteListing(ctx.params.id);
		return { deleted };
	},
);
