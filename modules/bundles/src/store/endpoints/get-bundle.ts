import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BundleController } from "../../service";

export const getBundle = createStoreEndpoint(
	"/bundles/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const bundle = await controller.getActiveBySlug(ctx.params.slug);

		if (!bundle) {
			return { error: "Bundle not found", status: 404 };
		}

		return { bundle };
	},
);
