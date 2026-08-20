import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminBulkAction = createAdminEndpoint(
	"/admin/invoices/bulk",
	{
		method: "POST",
		body: z.object({
			action: z.enum(["updateStatus", "delete"]),
			ids: z.array(z.string()).min(1),
			status: z
				.enum([
					"draft",
					"sent",
					"viewed",
					"paid",
					"partially_paid",
					"overdue",
					"void",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const { action, ids, status } = ctx.body;

		if (action === "updateStatus") {
			if (!status) {
				return { error: "Status is required for updateStatus", status: 400 };
			}
			return controller.bulkUpdateStatus(ids, status);
		}

		if (action === "delete") {
			return controller.bulkDelete(ids);
		}

		return { error: "Unknown action", status: 400 };
	},
);
