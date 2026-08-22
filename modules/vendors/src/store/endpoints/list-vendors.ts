import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const listVendors = createStoreEndpoint(
	"/vendors",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const vendors = await controller.listVendors({
			status: "active",
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		return { vendors };
	},
);
