import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const assignProduct = createAdminEndpoint(
	"/admin/vendors/:vendorId/products/assign",
	{
		method: "POST",
		params: z.object({
			vendorId: z.string().min(1),
		}),
		body: z.object({
			productId: z.string().min(1).max(200),
			commissionOverride: z.number().min(0).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const params: Parameters<typeof controller.assignProduct>[0] = {
			vendorId: ctx.params.vendorId,
			productId: ctx.body.productId,
		};
		if (ctx.body.commissionOverride != null)
			params.commissionOverride = ctx.body.commissionOverride;

		const assignment = await controller.assignProduct(params);

		return { assignment };
	},
);
