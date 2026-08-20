import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const adminUpdateFulfillment = createAdminEndpoint(
	"/admin/fulfillments/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z
				.enum(["pending", "shipped", "in_transit", "delivered", "failed"])
				.optional(),
			carrier: z.string().max(100).transform(sanitizeText).optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			trackingUrl: z.string().url().max(2000).optional(),
			notes: z.string().max(5000).transform(sanitizeText).optional(),
		}),
	},
	async () => {
		return {
			code: "FULFILLMENT_OWNER_OPERATION_REQUIRED",
			error: "Fulfillment updates belong to the standalone Fulfillment module.",
			status: 503,
		};
	},
);
