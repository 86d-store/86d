import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const listProducts = createAdminEndpoint(
	"/admin/vendors/:vendorId/products",
	{
		method: "GET",
		params: z.object({
			vendorId: z.string().min(1),
		}),
		query: z.object({
			status: z.enum(["active", "paused"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const listParams: Parameters<typeof controller.listVendorProducts>[0] = {
			vendorId: ctx.params.vendorId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.status != null) listParams.status = ctx.query.status;

		const products = await controller.listVendorProducts(listParams);

		const countParams: Parameters<typeof controller.countVendorProducts>[0] = {
			vendorId: ctx.params.vendorId,
		};
		if (ctx.query.status != null) countParams.status = ctx.query.status;

		const total = await controller.countVendorProducts(countParams);

		return { products, total };
	},
);
