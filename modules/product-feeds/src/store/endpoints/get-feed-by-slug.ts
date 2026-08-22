import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

export const getFeedBySlug = createStoreEndpoint(
	"/feeds/:slug",
	{
		method: "GET",
		params: z.object({ slug: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const feed = await controller.getFeedBySlug(ctx.params.slug);
		if (!feed) {
			return { error: "Feed not found", status: 404 };
		}

		if (feed.status !== "active") {
			return { error: "Feed is not active", status: 404 };
		}

		const output = await controller.getFeedOutput(feed.id);
		if (!output) {
			return { error: "Feed has not been generated yet", status: 404 };
		}

		return {
			output,
			format: feed.format,
			itemCount: feed.itemCount,
			lastGeneratedAt: feed.lastGeneratedAt,
		};
	},
);
