import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { MediaController } from "../../service";

export const updateAssetEndpoint = createAdminEndpoint(
	"/admin/media/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(500).transform(sanitizeText).optional(),
			altText: z
				.string()
				.max(1000)
				.transform(sanitizeText)
				.optional()
				.nullable(),
			url: z.string().url().optional(),
			folder: z.string().max(200).optional().nullable(),
			tags: z.array(z.string().max(100)).max(50).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const asset = await controller.updateAsset(ctx.params.id, {
			name: ctx.body.name,
			altText: ctx.body.altText ?? undefined,
			url: ctx.body.url,
			folder: ctx.body.folder ?? undefined,
			tags: ctx.body.tags,
			metadata: ctx.body.metadata,
		});
		return { asset };
	},
);
