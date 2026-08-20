import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const bulkAddMembers = createAdminEndpoint(
	"/admin/customer-groups/:id/members/bulk-add",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			customerIds: z.array(z.string().min(1).max(200)).min(1).max(500),
			expiresAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const opts: { expiresAt?: Date } = {};
		if (ctx.body.expiresAt != null) opts.expiresAt = ctx.body.expiresAt;

		const added = await controller.bulkAddMembers(
			ctx.params.id,
			ctx.body.customerIds,
			opts,
		);

		return { added, total: ctx.body.customerIds.length };
	},
);
