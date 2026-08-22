import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MediaController } from "../../service";

export const adminListAssetsEndpoint = createAdminEndpoint(
	"/admin/media",
	{
		method: "GET",
		query: z.object({
			folder: z.string().optional(),
			mimeType: z.string().optional(),
			tag: z.string().optional(),
			search: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		const all = await controller.listAssets({
			folder: ctx.query.folder,
			mimeType: ctx.query.mimeType,
			tag: ctx.query.tag,
			search: ctx.query.search,
		});
		const total = all.length;
		const assets = all.slice(skip, skip + limit);
		return { assets, total };
	},
);
