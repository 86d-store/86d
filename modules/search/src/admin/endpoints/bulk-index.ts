import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SearchController } from "../../service";

export const bulkIndex = createAdminEndpoint(
	"/admin/search/index/bulk",
	{
		method: "POST",
		body: z.object({
			items: z
				.array(
					z.object({
						entityType: z.string().min(1).max(100),
						entityId: z.string().min(1).max(200),
						title: z.string().min(1).max(500),
						body: z.string().max(10000).optional(),
						tags: z.array(z.string().max(100)).max(50).optional(),
						url: z.string().min(1).max(500),
						image: z.string().max(500).optional(),
						metadata: z
							.record(z.string().max(100), z.unknown())
							.refine((r) => Object.keys(r).length <= 50, "Too many keys")
							.optional(),
					}),
				)
				.min(1)
				.max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const result = await controller.bulkIndex(ctx.body.items);
		return result;
	},
);
