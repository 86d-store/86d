import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BundleController } from "../../service";

export const listActiveBundles = createStoreEndpoint(
	"/bundles",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const bundles = await controller.listActive({
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { bundles };
	},
);
