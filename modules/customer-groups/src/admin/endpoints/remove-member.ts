import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const removeMember = createAdminEndpoint(
	"/admin/customer-groups/:id/members/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			customerId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		await controller.removeMember(ctx.params.id, ctx.body.customerId);

		return { success: true };
	},
);
