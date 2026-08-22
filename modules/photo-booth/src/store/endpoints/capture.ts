import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PhotoBoothController } from "../../service";

export const captureEndpoint = createStoreEndpoint(
	"/photo-booth/capture",
	{
		method: "POST",
		body: z.object({
			sessionId: z.string().min(1).max(200),
			imageUrl: z.string().url().max(2048),
			thumbnailUrl: z.string().url().max(2048).optional(),
			caption: z.string().max(500).transform(sanitizeText).optional(),
			email: z.string().email().max(320).optional(),
			phoneNumber: z.string().max(20).transform(sanitizeText).optional(),
			tags: z
				.array(z.string().max(100).transform(sanitizeText))
				.max(50)
				.optional(),
			isPublic: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.photoBooth as PhotoBoothController;
		const photo = await controller.capturePhoto({
			sessionId: ctx.body.sessionId,
			imageUrl: ctx.body.imageUrl,
			thumbnailUrl: ctx.body.thumbnailUrl,
			caption: ctx.body.caption,
			email: ctx.body.email,
			phoneNumber: ctx.body.phoneNumber,
			tags: ctx.body.tags,
			isPublic: ctx.body.isPublic,
		});
		return { photo };
	},
);
