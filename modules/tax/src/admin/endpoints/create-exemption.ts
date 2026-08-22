import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TaxController, TaxExemptionType } from "../../service";

export const adminCreateExemption = createAdminEndpoint(
	"/admin/tax/exemptions/create",
	{
		method: "POST",
		body: z.object({
			customerId: z.string(),
			type: z.enum(["full", "category"]).optional(),
			categoryId: z.string().optional(),
			taxIdNumber: z.string().max(100).transform(sanitizeText).optional(),
			reason: z.string().max(500).transform(sanitizeText).optional(),
			expiresAt: z
				.string()
				.transform((v) => new Date(v))
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const exemption = await controller.createExemption({
			...ctx.body,
			type: ctx.body.type as TaxExemptionType | undefined,
		});
		return { exemption };
	},
);
