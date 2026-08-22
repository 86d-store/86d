import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminDeleteAddress = createAdminEndpoint(
	"/admin/customers/:customerId/addresses/:addressId/delete",
	{
		method: "POST",
		params: z.object({ customerId: z.string(), addressId: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const address = await controller.getAddress(ctx.params.addressId);
		if (!address || address.customerId !== ctx.params.customerId) {
			return { error: "Address not found", status: 404 };
		}
		await controller.deleteAddress(ctx.params.addressId);
		return { success: true };
	},
);
