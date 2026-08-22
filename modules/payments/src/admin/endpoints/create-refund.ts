import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PaymentController } from "../../service";

export const createRefund = createAdminEndpoint(
	"/admin/payments/:id/refund",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			amount: z.number().int().positive().optional(),
			reason: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		const intent = await controller.getIntent(ctx.params.id);
		if (!intent) return { error: "Payment intent not found", status: 404 };
		try {
			const refund = await controller.createRefund({
				intentId: ctx.params.id,
				amount: ctx.body.amount,
				reason: ctx.body.reason,
			});
			return { refund };
		} catch (err) {
			const message = err instanceof Error ? err.message : "Refund failed";
			return { error: message, status: 400 };
		}
	},
);
