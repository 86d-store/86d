import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QrCodeController } from "../../service";

export const listScansEndpoint = createAdminEndpoint(
	"/admin/qr-codes/:id/scans",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listScans(ctx.params.id, {});
		const total = all.length;
		const scans = all.slice(skip, skip + limit);
		return { scans, total };
	},
);
