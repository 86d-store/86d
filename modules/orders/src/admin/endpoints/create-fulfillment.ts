import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const adminCreateFulfillment = createAdminEndpoint(
	"/admin/orders/:id/fulfillments/create",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			carrier: z.string().max(100).transform(sanitizeText).optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			trackingUrl: z.string().url().max(2000).optional(),
			notes: z.string().max(5000).transform(sanitizeText).optional(),
			items: z.array(
				z.object({
					orderItemId: z.string(),
					quantity: z.number().int().min(1),
				}),
			),
		}),
	},
	async () => {
		return {
			code: "FULFILLMENT_OWNER_OPERATION_REQUIRED",
			error:
				"Fulfillment creation belongs to the standalone Fulfillment module.",
			status: 503,
		};
	},
);
