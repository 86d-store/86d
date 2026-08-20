import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const listGroups = createAdminEndpoint(
	"/admin/customer-groups",
	{
		method: "GET",
		query: z
			.object({
				type: z.enum(["manual", "automatic"]).optional(),
				activeOnly: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;
		const { query = {} } = ctx;

		const groups = await controller.listGroups({
			type: query.type,
			activeOnly: query.activeOnly === "true",
		});

		return { groups };
	},
);
