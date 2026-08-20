import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminAddTags = createAdminEndpoint(
	"/admin/customers/:id/tags",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			tags: z.array(z.string().min(1).max(50)).min(1).max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const customer = await controller.addTags(ctx.params.id, ctx.body.tags);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}
		return { customer };
	},
);

export const adminRemoveTags = createAdminEndpoint(
	"/admin/customers/:id/tags/remove",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			tags: z.array(z.string().min(1).max(50)).min(1).max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const customer = await controller.removeTags(ctx.params.id, ctx.body.tags);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}
		return { customer };
	},
);
