import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const createPlan = createAdminEndpoint(
	"/admin/warranties/plans/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			description: z.string().max(2000).optional(),
			type: z.enum(["manufacturer", "extended", "accidental_damage"]),
			durationMonths: z.number().int().min(1).max(120),
			price: z.number().min(0).optional(),
			coverageDetails: z.string().max(5000).optional(),
			exclusions: z.string().max(5000).optional(),
			productId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const plan = await controller.createPlan(ctx.body);
		return { plan };
	},
);
