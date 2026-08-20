import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const payoutStats = createAdminEndpoint(
	"/admin/vendors/payouts/stats",
	{
		method: "GET",
		query: z.object({
			vendorId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const stats = await controller.getPayoutStats(ctx.query.vendorId);

		return { stats };
	},
);
