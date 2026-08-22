import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const adminDeleteFulfillment = createAdminEndpoint(
	"/admin/fulfillments/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async () => {
		return {
			code: "FULFILLMENT_OWNER_OPERATION_REQUIRED",
			error:
				"Fulfillment deletion belongs to the standalone Fulfillment module.",
			status: 503,
		};
	},
);
