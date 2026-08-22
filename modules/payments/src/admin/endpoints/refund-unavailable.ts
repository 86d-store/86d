import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

export const createRefundUnavailable = createAdminEndpoint(
	"/admin/payments/:id/refund",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			amount: z.number().int().positive().optional(),
			reason: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async () => ({
		code: "PAYMENT_REFUND_OPERATION_V2_REQUIRED",
		error:
			"Refunds require a durable operation bound to the original Payment Connection.",
		status: 503,
	}),
);
