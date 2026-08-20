import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WarrantyController } from "../../service";

export const updatePlan = createAdminEndpoint(
	"/admin/warranties/plans/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			description: z.string().max(2000).optional(),
			durationMonths: z.number().int().min(1).max(120).optional(),
			price: z.number().min(0).optional(),
			coverageDetails: z.string().max(5000).optional(),
			exclusions: z.string().max(5000).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const plan = await controller.updatePlan(ctx.params.id, ctx.body);
		if (!plan) {
			return { error: "Plan not found", status: 404 };
		}
		return { plan };
	},
);
