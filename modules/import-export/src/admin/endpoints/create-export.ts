import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const createExport = createAdminEndpoint(
	"/admin/import-export/exports/create",
	{
		method: "POST",
		body: z.object({
			type: z.enum(["products", "customers", "orders", "inventory"]),
			format: z.enum(["csv", "json"]).optional(),
			filters: z
				.object({
					dateFrom: z.string().optional(),
					dateTo: z.string().optional(),
					status: z.string().optional(),
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.createExport({
			type: ctx.body.type,
			format: ctx.body.format,
			filters: ctx.body.filters,
		});
		return { job };
	},
);
