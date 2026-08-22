import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const completeReturn = createAdminEndpoint(
	"/admin/returns/:id/complete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			refundAmount: z.number().min(0),
		}),
	},
	async () => {
		return {
			code: "RETURN_COMPLETION_WORKFLOW_REQUIRED",
			error:
				"Completing a Return requires durable refund, tax, inventory, loyalty, and communication outcomes.",
			status: 503,
		};
	},
);
