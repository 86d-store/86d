import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	SyncEntityType,
	SyncStatus,
	ToastController,
} from "../../service";

export const listSyncRecordsEndpoint = createAdminEndpoint(
	"/admin/toast/sync-records",
	{
		method: "GET",
		query: z.object({
			entityType: z.enum(["menu-item", "order", "inventory"]).optional(),
			status: z.enum(["pending", "synced", "failed"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.toast as ToastController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listSyncRecords({
			entityType: ctx.query.entityType as SyncEntityType | undefined,
			status: ctx.query.status as SyncStatus | undefined,
		});
		const total = all.length;
		const records = all.slice(skip, skip + limit);
		return { records, total };
	},
);
