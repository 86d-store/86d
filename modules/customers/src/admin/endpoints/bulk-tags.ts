import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminBulkTags = createAdminEndpoint(
	"/admin/customers/bulk-tags",
	{
		method: "POST",
		body: z.object({
			action: z.enum(["add", "remove"]),
			customerIds: z.array(z.string()).min(1).max(100),
			tags: z.array(z.string().min(1).max(50)).min(1).max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const { action, customerIds, tags } = ctx.body;

		if (action === "add") {
			const result = await controller.bulkAddTags(customerIds, tags);
			return result;
		}
		const result = await controller.bulkRemoveTags(customerIds, tags);
		return result;
	},
);
