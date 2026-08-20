import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ImportExportController } from "../../service";

export const processImportRow = createAdminEndpoint(
	"/admin/import-export/imports/:id/process-row",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			rowNumber: z.number().int().min(1),
			success: z.boolean(),
			error: z
				.object({
					row: z.number().int(),
					field: z.string().optional(),
					message: z.string(),
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.processRow(
			ctx.params.id,
			ctx.body.rowNumber,
			ctx.body.success,
			ctx.body.error,
		);

		if (!job) {
			return {
				error: "Import job not found or not in processable state",
				status: 404,
			};
		}

		return { job };
	},
);
