import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const deleteVendor = createAdminEndpoint(
	"/admin/vendors/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const deleted = await controller.deleteVendor(ctx.params.id);
		if (!deleted) {
			return { error: "Vendor not found", status: 404 };
		}

		return { success: true };
	},
);
