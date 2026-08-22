import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const adminDeleteReturn = createAdminEndpoint(
	"/admin/orders/returns/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async () => {
		return {
			code: "RETURN_OWNER_OPERATION_REQUIRED",
			error: "Return deletion belongs to the standalone Returns module.",
			status: 503,
		};
	},
);
