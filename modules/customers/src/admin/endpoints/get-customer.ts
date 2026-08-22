import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminGetCustomer = createAdminEndpoint(
	"/admin/customers/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const customer = await controller.getById(ctx.params.id);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}

		const addresses = await controller.listAddresses(ctx.params.id);
		return { customer, addresses };
	},
);
