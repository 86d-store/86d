import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const updatePayoutStatus = createAdminEndpoint(
	"/admin/vendors/payouts/:id/status",
	{
		method: "PATCH",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			status: z.enum(["pending", "processing", "completed", "failed"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const payout = await controller.updatePayoutStatus(
			ctx.params.id,
			ctx.body.status,
		);
		if (!payout) {
			return { error: "Payout not found", status: 404 };
		}

		return { payout };
	},
);
