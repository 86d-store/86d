import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const createRedirectEndpoint = createAdminEndpoint(
	"/admin/seo/redirects/create",
	{
		method: "POST",
		body: z.object({
			fromPath: z.string().min(1).max(2000).transform(sanitizeText),
			toPath: z.string().min(1).max(2000).transform(sanitizeText),
			statusCode: z
				.enum(["301", "302", "307", "308"])
				.transform(Number)
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const redirect = await controller.createRedirect({
			fromPath: ctx.body.fromPath,
			toPath: ctx.body.toPath,
			statusCode: ctx.body.statusCode as 301 | 302 | 307 | 308 | undefined,
		});
		return { redirect };
	},
);
