import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const createGroup = createAdminEndpoint(
	"/admin/customer-groups/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(100),
			slug: z.string().min(1).max(100),
			description: z.string().max(500).optional(),
			type: z.enum(["manual", "automatic"]).optional(),
			priority: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const group = await controller.createGroup(ctx.body);

		return { group };
	},
);
