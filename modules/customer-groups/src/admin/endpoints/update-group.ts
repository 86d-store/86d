import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const updateGroup = createAdminEndpoint(
	"/admin/customer-groups/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).max(100).optional(),
			slug: z.string().min(1).max(100).optional(),
			description: z.string().max(500).optional(),
			type: z.enum(["manual", "automatic"]).optional(),
			isActive: z.boolean().optional(),
			priority: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const group = await controller.updateGroup(ctx.params.id, ctx.body);

		return { group };
	},
);
