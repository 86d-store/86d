import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SocialSharingController } from "../../service";

export const shareEndpoint = createStoreEndpoint(
	"/social-sharing/share",
	{
		method: "POST",
		body: z.object({
			targetType: z.enum([
				"product",
				"collection",
				"page",
				"blog-post",
				"custom",
			]),
			targetId: z.string().max(200),
			network: z.enum([
				"twitter",
				"facebook",
				"pinterest",
				"linkedin",
				"whatsapp",
				"email",
				"copy-link",
			]),
			url: z.string().url().max(2000),
			referrer: z.string().url().max(2000).optional(),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const shareEvent = await controller.recordShare({
			targetType: ctx.body.targetType,
			targetId: ctx.body.targetId,
			network: ctx.body.network,
			url: ctx.body.url,
			referrer: ctx.body.referrer,
			sessionId: ctx.body.sessionId,
		});
		return { shareEvent };
	},
);
