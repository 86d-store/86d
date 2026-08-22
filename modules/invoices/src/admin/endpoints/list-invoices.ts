import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InvoiceController } from "../../service";

export const adminListInvoices = createAdminEndpoint(
	"/admin/invoices",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(100).optional().default(20),
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
			search: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const { page, limit, status, search } = ctx.query;
		const offset = (page - 1) * limit;

		const { invoices, total } = await controller.list({
			limit,
			offset,
			status,
			search: search || undefined,
		});

		return {
			invoices,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
