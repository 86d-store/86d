import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerGroupController } from "../../service";

export const evaluateRules = createAdminEndpoint(
	"/admin/customer-groups/evaluate",
	{
		method: "POST",
		body: z.object({
			customerData: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 100, "Too many keys"),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const matchingGroupIds = await controller.evaluateRules(
			ctx.body.customerData,
		);

		return { matchingGroupIds };
	},
);
