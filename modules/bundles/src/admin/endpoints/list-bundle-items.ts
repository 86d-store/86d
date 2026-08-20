import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BundleController } from "../../service";

export const listBundleItems = createAdminEndpoint(
	"/admin/bundles/:id/items",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const items = await controller.listItems(ctx.params.id);
		return { items };
	},
);
