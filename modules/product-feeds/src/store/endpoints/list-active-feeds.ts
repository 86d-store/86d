import { createStoreEndpoint } from "@86d-app/core/api";
import type { ProductFeedsController } from "../../service";

export const listActiveFeeds = createStoreEndpoint(
	"/feeds",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const feeds = await controller.listFeeds({ status: "active" });

		return {
			feeds: feeds.map((f) => ({
				name: f.name,
				slug: f.slug,
				channel: f.channel,
				format: f.format,
				itemCount: f.itemCount,
				lastGeneratedAt: f.lastGeneratedAt,
			})),
		};
	},
);
