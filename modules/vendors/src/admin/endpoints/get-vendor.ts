import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const getVendor = createAdminEndpoint(
	"/admin/vendors/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const vendor = await controller.getVendor(ctx.params.id);
		if (!vendor) {
			return { error: "Vendor not found", status: 404 };
		}

		return { vendor };
	},
);
