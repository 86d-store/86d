import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const setPricing = createAdminEndpoint(
	"/admin/customer-groups/:id/pricing",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			adjustmentType: z.enum(["percentage", "fixed"]),
			value: z.number(),
			scope: z.enum(["all", "category", "product"]).optional(),
			scopeId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const adjustment = await controller.setPriceAdjustment({
			groupId: ctx.params.id,
			adjustmentType: ctx.body.adjustmentType,
			value: ctx.body.value,
			scope: ctx.body.scope,
			scopeId: ctx.body.scopeId,
		});

		return { adjustment };
	},
);
