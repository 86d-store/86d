import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const listMembers = createAdminEndpoint(
	"/admin/customer-groups/:id/members",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
		query: z
			.object({
				includeExpired: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const members = await controller.listMembers(ctx.params.id, {
			includeExpired: ctx.query?.includeExpired === "true",
		});

		return { members };
	},
);
