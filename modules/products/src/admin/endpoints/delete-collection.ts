import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const deleteCollection = createAdminEndpoint(
	"/admin/products/collections/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		return ctx.context.controllers.collection.delete(ctx);
	},
);
