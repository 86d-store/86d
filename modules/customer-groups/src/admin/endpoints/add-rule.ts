import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const addRule = createAdminEndpoint(
	"/admin/customer-groups/:id/rules/add",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			field: z.string().min(1),
			operator: z.enum([
				"equals",
				"not_equals",
				"contains",
				"not_contains",
				"greater_than",
				"less_than",
				"in",
				"not_in",
			]),
			value: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		const rule = await controller.addRule({
			groupId: ctx.params.id,
			field: ctx.body.field,
			operator: ctx.body.operator,
			value: ctx.body.value,
		});

		return { rule };
	},
);
