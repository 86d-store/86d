import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { VendorController } from "../../service";

export const createPayout = createAdminEndpoint(
	"/admin/vendors/:vendorId/payouts/create",
	{
		method: "POST",
		params: z.object({
			vendorId: z.string().min(1),
		}),
		body: z.object({
			amount: z.number().min(0.01),
			currency: z.string().min(3).max(3),
			method: z.string().max(100).transform(sanitizeText).optional(),
			reference: z.string().max(500).transform(sanitizeText).optional(),
			periodStart: z.coerce.date(),
			periodEnd: z.coerce.date(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const params: Parameters<typeof controller.createPayout>[0] = {
			vendorId: ctx.params.vendorId,
			amount: ctx.body.amount,
			currency: ctx.body.currency,
			periodStart: ctx.body.periodStart,
			periodEnd: ctx.body.periodEnd,
		};
		if (ctx.body.method != null) params.method = ctx.body.method;
		if (ctx.body.reference != null) params.reference = ctx.body.reference;
		if (ctx.body.notes != null) params.notes = ctx.body.notes;

		const payout = await controller.createPayout(params);

		return { payout };
	},
);
