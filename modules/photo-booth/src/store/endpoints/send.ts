import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PhotoBoothController } from "../../service";

export const sendEndpoint = createStoreEndpoint(
	"/photo-booth/send",
	{
		method: "POST",
		body: z
			.object({
				photoId: z.string().min(1).max(200),
				email: z.string().email().max(320).optional(),
				phoneNumber: z.string().max(20).transform(sanitizeText).optional(),
			})
			.refine((d) => d.email || d.phoneNumber, {
				message: "Either email or phoneNumber is required",
			}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.photoBooth as PhotoBoothController;
		const photo = await controller.sendPhoto(ctx.body.photoId, {
			email: ctx.body.email,
			phoneNumber: ctx.body.phoneNumber,
		});
		return { photo };
	},
);
