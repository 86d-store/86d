import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { productFeedsSchema } from "./schema";
import { createProductFeedsController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	CategoryMapping,
	CreateFeedParams,
	Feed,
	FeedChannel,
	FeedFilters,
	FeedFormat,
	FeedItem,
	FeedItemIssue,
	FeedItemStatus,
	FeedStats,
	FeedStatus,
	FieldMapping,
	GenerateFeedResult,
	ProductData,
	ProductFeedsController,
	UpdateFeedParams,
} from "./service";

export interface ProductFeedsOptions extends ModuleConfig {
	/** Maximum number of feeds per store (default: "50") */
	maxFeeds?: string;
	/** Maximum products per feed generation (default: "100000") */
	maxProductsPerFeed?: string;
}

export default function productFeeds(options?: ProductFeedsOptions): Module {
	return {
		id: "product-feeds",
		version: "0.0.1",
		schema: productFeedsSchema,
		exports: {
			read: ["feedData", "feedStatus", "feedOutput"],
		},
		events: {
			emits: [
				"feed.created",
				"feed.updated",
				"feed.deleted",
				"feed.generated",
				"feed.generation.error",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createProductFeedsController(ctx.data);
			return {
				controllers: { productFeeds: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/product-feeds",
					component: "ProductFeedsOverview",
					label: "Product Feeds",
					icon: "Rss",
					group: "Marketing",
				},
				{
					path: "/admin/product-feeds/:id",
					component: "ProductFeedDetail",
				},
			],
		},

		options,
	};
}
