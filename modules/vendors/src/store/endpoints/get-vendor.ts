import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const getVendor = createStoreEndpoint(
	"/vendors/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const vendor = await controller.getVendorBySlug(ctx.params.slug);
		if (vendor?.status !== "active") {
			return { error: "Vendor not found", status: 404 };
		}

		return { vendor };
	},
);
