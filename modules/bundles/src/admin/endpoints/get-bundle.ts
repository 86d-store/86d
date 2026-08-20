import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BundleController } from "../../service";

export const getBundle = createAdminEndpoint(
	"/admin/bundles/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const bundle = await controller.getWithItems(ctx.params.id);

		if (!bundle) {
			return { error: "Bundle not found", status: 404 };
		}

		return { bundle };
	},
);
