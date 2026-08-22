import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PhotoBoothController } from "../../service";

export const createSessionEndpoint = createAdminEndpoint(
	"/admin/photo-booth/sessions/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			settings: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.photoBooth as PhotoBoothController;
		const session = await controller.createSession({
			name: ctx.body.name,
			description: ctx.body.description,
			settings: ctx.body.settings,
		});
		return { session };
	},
);
