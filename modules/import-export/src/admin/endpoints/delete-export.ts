import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const deleteExport = createAdminEndpoint(
	"/admin/import-export/exports/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const deleted = await controller.deleteExport(ctx.params.id);

		if (!deleted) {
			return { error: "Export job not found", status: 404 };
		}

		return { success: true };
	},
);
