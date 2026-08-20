import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ImportExportController } from "../../service";

export const cancelImport = createAdminEndpoint(
	"/admin/import-export/imports/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.cancelImport(ctx.params.id);

		if (!job) {
			return {
				error: "Import job not found or already completed",
				status: 404,
			};
		}

		return { job };
	},
);
