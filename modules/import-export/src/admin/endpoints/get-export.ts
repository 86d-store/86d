import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const getExport = createAdminEndpoint(
	"/admin/import-export/exports/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const job = await controller.getExport(ctx.params.id);

		if (!job) {
			return { error: "Export job not found", status: 404 };
		}

		return { job };
	},
);
