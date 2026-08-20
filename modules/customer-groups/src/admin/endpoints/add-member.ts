import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const addMember = createAdminEndpoint(
	"/admin/customer-groups/:id/members/add",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			customerId: z.string().min(1),
			expiresAt: z.string().datetime().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const membership = await controller.addMember({
			groupId: ctx.params.id,
			customerId: ctx.body.customerId,
			expiresAt: ctx.body.expiresAt ? new Date(ctx.body.expiresAt) : undefined,
		});

		return { membership };
	},
);
