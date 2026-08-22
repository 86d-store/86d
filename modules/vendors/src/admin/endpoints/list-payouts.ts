import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const listPayouts = createAdminEndpoint(
	"/admin/vendors/:vendorId/payouts",
	{
		method: "GET",
		params: z.object({
			vendorId: z.string().min(1),
		}),
		query: z.object({
			status: z
				.enum(["pending", "processing", "completed", "failed"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const listParams: Parameters<typeof controller.listPayouts>[0] = {
			vendorId: ctx.params.vendorId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.status != null) listParams.status = ctx.query.status;

		const payouts = await controller.listPayouts(listParams);

		const countParams: Parameters<typeof controller.countPayouts>[0] = {
			vendorId: ctx.params.vendorId,
		};
		if (ctx.query.status != null) countParams.status = ctx.query.status;

		const total = await controller.countPayouts(countParams);

		return { payouts, total };
	},
);
