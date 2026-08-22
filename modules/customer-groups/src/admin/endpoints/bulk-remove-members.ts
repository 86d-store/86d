import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const bulkRemoveMembers = createAdminEndpoint(
	"/admin/customer-groups/:id/members/bulk-remove",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			customerIds: z.array(z.string().min(1).max(200)).min(1).max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;
		const removed = await controller.bulkRemoveMembers(
			ctx.params.id,
			ctx.body.customerIds,
		);

		return { removed, total: ctx.body.customerIds.length };
	},
);
