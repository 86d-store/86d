import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const listVendors = createAdminEndpoint(
	"/admin/vendors",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["pending", "active", "suspended", "closed"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const listParams: Parameters<typeof controller.listVendors>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.status != null) listParams.status = ctx.query.status;

		const vendors = await controller.listVendors(listParams);

		const countParams: Parameters<typeof controller.countVendors>[0] = {};
		if (ctx.query.status != null) countParams.status = ctx.query.status;

		const total = await controller.countVendors(countParams);

		return { vendors, total };
	},
);
