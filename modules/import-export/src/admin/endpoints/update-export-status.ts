import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const updateExportStatus = createAdminEndpoint(
	"/admin/import-export/exports/:id/status",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			status: z.enum(["pending", "processing", "completed", "failed"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.updateExportStatus(
			ctx.params.id,
			ctx.body.status,
		);

		if (!job) {
			return { error: "Export job not found", status: 404 };
		}

		return { job };
	},
);
