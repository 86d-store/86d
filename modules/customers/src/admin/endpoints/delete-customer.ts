import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminDeleteCustomer = createAdminEndpoint(
	"/admin/customers/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Customer not found", status: 404 };
		}
		await controller.delete(ctx.params.id);
		return { success: true };
	},
);
