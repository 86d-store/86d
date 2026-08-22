import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { Network, SocialSharingController } from "../../service";

export const urlEndpoint = createStoreEndpoint(
	"/social-sharing/url",
	{
		method: "GET",
		query: z.object({
			network: z.enum([
				"twitter",
				"facebook",
				"pinterest",
				"linkedin",
				"whatsapp",
				"email",
				"copy-link",
			]),
			targetUrl: z.string().url().max(2000),
			message: z.string().max(500).transform(sanitizeText).optional(),
			hashtags: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const hashtags = ctx.query.hashtags
			? ctx.query.hashtags.split(",").map((h) => h.trim())
			: undefined;
		const url = controller.generateShareUrl(
			ctx.query.network as Network,
			ctx.query.targetUrl,
			ctx.query.message,
			hashtags,
		);
		return { url };
	},
);
