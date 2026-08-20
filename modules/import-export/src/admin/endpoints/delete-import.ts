import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ImportExportController } from "../../service";

export const deleteImport = createAdminEndpoint(
	"/admin/import-export/imports/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const deleted = await controller.deleteImport(ctx.params.id);

		if (!deleted) {
			return { error: "Import job not found", status: 404 };
		}

		return { success: true };
	},
);
