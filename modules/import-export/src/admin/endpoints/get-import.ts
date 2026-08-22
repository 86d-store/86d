import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const getImport = createAdminEndpoint(
	"/admin/import-export/imports/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.getImport(ctx.params.id);

		if (!job) {
			return { error: "Import job not found", status: 404 };
		}

		return { job };
	},
);
