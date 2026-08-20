import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PhotoBoothController } from "../../service";

export const listPhotosEndpoint = createAdminEndpoint(
	"/admin/photo-booth/photos",
	{
		method: "GET",
		query: z.object({
			sessionId: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.photoBooth as PhotoBoothController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listPhotos({
			sessionId: ctx.query.sessionId,
		});
		const total = all.length;
		const photos = all.slice(skip, skip + limit);
		return { photos, total };
	},
);
