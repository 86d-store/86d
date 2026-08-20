import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EtsyController } from "../../service";

export const deleteListingEndpoint = createAdminEndpoint(
	"/admin/etsy/listings/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const deleted = await controller.deleteListing(ctx.params.id);
		return { deleted };
	},
);
