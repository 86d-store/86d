import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminSetDefaultAddress = createAdminEndpoint(
	"/admin/customers/:customerId/addresses/:addressId/set-default",
	{
		method: "POST",
		params: z.object({ customerId: z.string(), addressId: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const updated = await controller.setDefaultAddress(
			ctx.params.customerId,
			ctx.params.addressId,
		);
		if (!updated) {
			return { error: "Address not found", status: 404 };
		}
		return { address: updated };
	},
);
