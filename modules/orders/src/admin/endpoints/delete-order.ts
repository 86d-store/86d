import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const adminDeleteOrder = createAdminEndpoint(
	"/admin/orders/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async () => {
		return {
			code: "ORDER_HISTORY_IMMUTABLE",
			error:
				"Accepted Orders are immutable commerce history and cannot be deleted.",
			status: 422,
		};
	},
);
