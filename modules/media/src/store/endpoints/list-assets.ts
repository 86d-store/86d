import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { MediaController } from "../../service";

export const listAssetsEndpoint = createStoreEndpoint(
	"/media",
	{
		method: "GET",
		query: z.object({
			folder: z.string().max(200).transform(sanitizeText).optional(),
			mimeType: z.string().max(100).optional(),
			tag: z.string().max(100).transform(sanitizeText).optional(),
			search: z.string().max(200).transform(sanitizeText).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		const assets = await controller.listAssets({
			folder: ctx.query.folder,
			mimeType: ctx.query.mimeType,
			tag: ctx.query.tag,
			search: ctx.query.search,
			take: limit,
			skip,
		});
		return { assets, total: assets.length };
	},
);
