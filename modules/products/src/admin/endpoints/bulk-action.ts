import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const bulkAction = createAdminEndpoint(
	"/admin/products/bulk",
	{
		method: "POST",
		body: z.object({
			action: z.enum(["updateStatus", "delete"]),
			ids: z.array(z.string()).min(1),
			status: z.enum(["draft", "active", "archived"]).optional(),
		}),
	},
	async (ctx) => {
		const controllers = ctx.context.controllers;
		const { action, ids, status } = ctx.body;

		if (action === "updateStatus") {
			if (!status) {
				return {
					error: "Status is required for updateStatus action",
					status: 400,
				};
			}
			return controllers.bulk.updateStatus({
				...ctx,
				body: { ids, status },
			});
		}

		if (action === "delete") {
			return controllers.bulk.deleteMany({
				...ctx,
				body: { ids },
			});
		}

		return { error: "Unknown action", status: 400 };
	},
);
