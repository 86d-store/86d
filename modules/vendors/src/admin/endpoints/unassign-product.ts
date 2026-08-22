import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { VendorController } from "../../service";

export const unassignProduct = createAdminEndpoint(
	"/admin/vendors/:vendorId/products/:productId/unassign",
	{
		method: "DELETE",
		params: z.object({
			vendorId: z.string().min(1),
			productId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const removed = await controller.unassignProduct({
			vendorId: ctx.params.vendorId,
			productId: ctx.params.productId,
		});

		if (!removed) {
			return { error: "Product assignment not found", status: 404 };
		}

		return { success: true };
	},
);
