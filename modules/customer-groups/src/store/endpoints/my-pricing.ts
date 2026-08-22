import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const myPricing = createStoreEndpoint(
	"/customer-groups/pricing",
	{
		method: "GET",
		query: z
			.object({
				scope: z.enum(["all", "category", "product"]).optional(),
				scopeId: z.string().max(200).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;
		const customerId = ctx.context.session?.user?.id;

		if (!customerId) {
			return { adjustments: [] };
		}

		const params: { scope?: "all" | "category" | "product"; scopeId?: string } =
			{};
		if (ctx.query?.scope != null) params.scope = ctx.query.scope;
		if (ctx.query?.scopeId != null) params.scopeId = ctx.query.scopeId;

		const adjustments = await controller.getCustomerPricing(customerId, params);

		return { adjustments };
	},
);
