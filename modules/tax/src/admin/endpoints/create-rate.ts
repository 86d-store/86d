import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { TaxController, TaxRateType } from "../../service";

export const adminCreateRate = createAdminEndpoint(
	"/admin/tax/rates/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			country: z.string().length(2),
			state: z.string().max(100).transform(sanitizeText).optional(),
			city: z.string().max(200).transform(sanitizeText).optional(),
			postalCode: z.string().max(20).optional(),
			rate: z.number().min(0).max(1),
			type: z.enum(["percentage", "fixed"]).optional(),
			categoryId: z.string().optional(),
			enabled: z.boolean().optional(),
			priority: z.number().int().min(0).optional(),
			compound: z.boolean().optional(),
			inclusive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const taxRate = await controller.createRate({
			...ctx.body,
			type: ctx.body.type as TaxRateType | undefined,
		});
		return { taxRate };
	},
);
