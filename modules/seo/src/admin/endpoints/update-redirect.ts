import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const updateRedirectEndpoint = createAdminEndpoint(
	"/admin/seo/redirects/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			fromPath: z.string().min(1).max(2000).transform(sanitizeText).optional(),
			toPath: z.string().min(1).max(2000).transform(sanitizeText).optional(),
			statusCode: z
				.enum(["301", "302", "307", "308"])
				.transform(Number)
				.optional(),
			active: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const redirect = await controller.updateRedirect(ctx.params.id, {
			fromPath: ctx.body.fromPath,
			toPath: ctx.body.toPath,
			statusCode: ctx.body.statusCode as 301 | 302 | 307 | 308 | undefined,
			active: ctx.body.active,
		});
		return { redirect };
	},
);
