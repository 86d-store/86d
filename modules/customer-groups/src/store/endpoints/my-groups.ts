import { createStoreEndpoint } from "@86d-app/core/api";
import type { CustomerGroupController } from "../../service";

export const myGroups = createStoreEndpoint(
	"/customer-groups/mine",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;
		const customerId = ctx.context.session?.user?.id;

		if (!customerId) {
			return { groups: [] };
		}

		const groups = await controller.getCustomerGroups(customerId);

		return { groups };
	},
);
