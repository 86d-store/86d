import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const getGroup = createAdminEndpoint(
	"/admin/customer-groups/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const group = await controller.getGroup(ctx.params.id);

		if (!group) {
			return { error: "Customer group not found", status: 404 };
		}

		return { group };
	},
);
