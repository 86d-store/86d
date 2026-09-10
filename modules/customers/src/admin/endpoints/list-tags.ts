import { createAdminEndpoint } from "@86d-store/core/api";
import type { CustomerController } from "../../service";

export const adminListTags = createAdminEndpoint(
	"/admin/customers/tags",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const tags = await controller.listAllTags();
		return { tags };
	},
);
