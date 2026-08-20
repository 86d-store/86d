import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import { RETURN_REASONS } from "../../service";

export const createMyReturn = createStoreEndpoint(
	"/orders/me/:id/returns/create",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			type: z.enum(["refund", "exchange", "store_credit"]).optional(),
			reason: z.enum(RETURN_REASONS),
			customerNotes: z.string().max(2000).transform(sanitizeText).optional(),
			items: z
				.array(
					z.object({
						orderItemId: z.string().max(200),
						quantity: z.number().int().min(1),
						reason: z.string().max(500).transform(sanitizeText).optional(),
					}),
				)
				.max(50),
		}),
	},
	async () => {
		return {
			code: "RETURN_OWNER_OPERATION_REQUIRED",
			error: "Return creation belongs to the standalone Returns module.",
			status: 503,
		};
	},
);
