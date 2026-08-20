import { createAdminEndpoint } from "@86d-app/core/api";
import type { CustomerGroupController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/customer-groups/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const stats = await controller.getStats();

		return { stats };
	},
);
