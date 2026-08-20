import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const markReceived = createAdminEndpoint(
	"/admin/returns/:id/received",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async () => {
		return {
			code: "RETURN_RECEIPT_WORKFLOW_REQUIRED",
			error:
				"Receiving a Return requires a durable disposition and restock workflow.",
			status: 503,
		};
	},
);
