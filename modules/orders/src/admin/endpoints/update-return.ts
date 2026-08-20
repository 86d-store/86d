import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const adminUpdateReturn = createAdminEndpoint(
	"/admin/orders/returns/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z
				.enum([
					"requested",
					"approved",
					"rejected",
					"shipped_back",
					"received",
					"refunded",
					"completed",
				])
				.optional(),
			adminNotes: z.string().max(5000).transform(sanitizeText).optional(),
			refundAmount: z.number().min(0).optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			trackingUrl: z.string().url().max(2000).optional(),
			carrier: z.string().max(100).transform(sanitizeText).optional(),
		}),
	},
	async () => {
		return {
			code: "RETURN_OWNER_OPERATION_REQUIRED",
			error: "Return updates belong to the standalone Returns module.",
			status: 503,
		};
	},
);
