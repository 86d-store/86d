import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const deleteGroup = createAdminEndpoint(
	"/admin/customer-groups/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		await controller.deleteGroup(ctx.params.id);

		return { success: true };
	},
);
