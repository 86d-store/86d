import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ImportExportController } from "../../service";

export const createImport = createAdminEndpoint(
	"/admin/import-export/imports/create",
	{
		method: "POST",
		body: z.object({
			type: z.enum(["products", "customers", "orders", "inventory"]),
			filename: z.string().min(1).max(255),
			totalRows: z.number().int().min(1).max(100000),
			options: z
				.object({
					updateExisting: z.boolean().optional(),
					skipDuplicates: z.boolean().optional(),
					dryRun: z.boolean().optional(),
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.createImport({
			type: ctx.body.type,
			filename: ctx.body.filename,
			totalRows: ctx.body.totalRows,
			options: ctx.body.options,
		});
		return { job };
	},
);
