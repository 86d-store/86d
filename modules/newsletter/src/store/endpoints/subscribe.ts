import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { NewsletterController } from "../../service";

export const subscribeEndpoint = createStoreEndpoint(
	"/newsletter/subscribe",
	{
		method: "POST",
		body: z.object({
			email: z.string().email().max(320),
			firstName: z.string().max(200).transform(sanitizeText).optional(),
			lastName: z.string().max(200).transform(sanitizeText).optional(),
			source: z.string().max(200).transform(sanitizeText).optional(),
			tags: z
				.array(z.string().max(100).transform(sanitizeText))
				.max(50)
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const subscriber = await controller.subscribe({
			email: ctx.body.email,
			firstName: ctx.body.firstName,
			lastName: ctx.body.lastName,
			source: ctx.body.source,
			tags: ctx.body.tags,
		});
		return { subscriber };
	},
);
