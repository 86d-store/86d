import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const updateStatus = createAdminEndpoint(
	"/admin/vendors/:id/status",
	{
		method: "PATCH",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			status: z.enum(["pending", "active", "suspended", "closed"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const vendor = await controller.updateVendorStatus(
			ctx.params.id,
			ctx.body.status,
		);
		if (!vendor) {
			return { error: "Vendor not found", status: 404 };
		}

		return { vendor };
	},
);
