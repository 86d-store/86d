import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AffiliateController } from "../../service";

export const trackClickEndpoint = createStoreEndpoint(
	"/affiliates/track",
	{
		method: "POST",
		body: z.object({
			slug: z.string().max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;

		const link = await controller.getLinkBySlug(ctx.body.slug);
		if (!link) return { error: "Link not found", status: 404 };
		if (!link.active) return { error: "Link is no longer active", status: 404 };

		await controller.recordClick(link.id);
		return { targetUrl: link.targetUrl };
	},
);
