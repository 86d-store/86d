import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const setExportData = createAdminEndpoint(
	"/admin/import-export/exports/:id/data",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			data: z.string().max(10_000_000),
			totalRows: z.number().min(0).max(1_000_000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.setExportData(
			ctx.params.id,
			ctx.body.data,
			ctx.body.totalRows,
		);

		if (!job) {
			return { error: "Export job not found", status: 404 };
		}

		return { job };
	},
);
