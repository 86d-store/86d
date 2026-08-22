import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InvoiceController } from "../../service";

export const listMyInvoices = createStoreEndpoint(
	"/invoices/me",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.invoice as InvoiceController;
		const { page, limit } = ctx.query;
		const offset = (page - 1) * limit;

		const { invoices, total } = await controller.listForCustomer(userId, {
			limit,
			offset,
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
