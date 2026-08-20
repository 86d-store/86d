import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminExportCustomers = createAdminEndpoint(
	"/admin/customers/export",
	{
		method: "GET",
		query: z.object({
			search: z.string().optional(),
			tag: z.string().optional(),
			dateFrom: z.string().optional(),
			dateTo: z.string().optional(),
		}),
	},
	async (ctx) => {
		const { search, tag, dateFrom, dateTo } = ctx.query;
		const controller = ctx.context.controllers.customer as CustomerController;
		const customers = await controller.listForExport({
			...(search !== undefined ? { search } : {}),
			...(tag !== undefined ? { tag } : {}),
			...(dateFrom !== undefined ? { dateFrom } : {}),
			...(dateTo !== undefined ? { dateTo } : {}),
		});

		return { customers, total: customers.length };
	},
);
