import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ImportExportController } from "../../service";

export const updateImportStatus = createAdminEndpoint(
	"/admin/import-export/imports/:id/status",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			status: z.enum([
				"pending",
				"validating",
				"processing",
				"completed",
				"failed",
				"cancelled",
			]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.updateImportStatus(
			ctx.params.id,
			ctx.body.status,
		);

		if (!job) {
			return { error: "Import job not found", status: 404 };
		}

		return { job };
	},
);
