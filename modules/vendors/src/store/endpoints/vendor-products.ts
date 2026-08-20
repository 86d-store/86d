import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const vendorProducts = createStoreEndpoint(
	"/vendors/:vendorId/products",
	{
		method: "GET",
		params: z.object({
			vendorId: z.string().min(1).max(200),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const vendor = await controller.getVendor(ctx.params.vendorId);
		if (!vendor || vendor.status !== "active") {
			return { error: "Vendor not found", status: 404 };
		}

		const products = await controller.listVendorProducts({
			vendorId: ctx.params.vendorId,
			status: "active",
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		return { products };
	},
);
