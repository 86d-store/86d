import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ImportExportController } from "../../service";

export const listExports = createAdminEndpoint(
	"/admin/import-export/exports",
	{
		method: "GET",
		query: z.object({
			type: z.string().optional(),
			status: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.importExport as ImportExportController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listExports({
			type: ctx.query.type as
				| "products"
				| "customers"
				| "orders"
				| "inventory"
				| undefined,
			status: ctx.query.status as
				| "pending"
				| "processing"
				| "completed"
				| "failed"
				| undefined,
		});
		const total = all.length;
		const jobs = all.slice(skip, skip + take);
		return { jobs, total };
	},
);
