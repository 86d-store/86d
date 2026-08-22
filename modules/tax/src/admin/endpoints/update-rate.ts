import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TaxController, TaxRateType } from "../../service";

export const adminUpdateRate = createAdminEndpoint(
	"/admin/tax/rates/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			rate: z.number().min(0).max(1).optional(),
			type: z.enum(["percentage", "fixed"]).optional(),
			enabled: z.boolean().optional(),
			priority: z.number().int().min(0).optional(),
			compound: z.boolean().optional(),
			inclusive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const taxRate = await controller.updateRate(ctx.params.id, {
			...ctx.body,
			type: ctx.body.type as TaxRateType | undefined,
		});
		if (!taxRate) {
			return { error: "Tax rate not found", status: 404 };
		}
		return { taxRate };
	},
);
