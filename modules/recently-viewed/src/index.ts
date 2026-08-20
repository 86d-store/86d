import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { recentlyViewedStorage } from "./schema";
import { createRecentlyViewedController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	PopularProduct,
	ProductView,
	RecentlyViewedController,
} from "./service";

export interface RecentlyViewedOptions extends ModuleConfig {
	/** Maximum views to retain per customer (oldest pruned). Default: no limit. */
	maxViewsPerCustomer?: string;
}

export default function recentlyViewed(
	options?: RecentlyViewedOptions,
): Module {
	return {
		id: "recently-viewed",
		version: "0.0.1",
		storage: recentlyViewedStorage,
		exports: {
			read: ["recentlyViewedProducts", "popularProducts"],
		},
		events: {
			emits: ["product.viewed"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createRecentlyViewedController(ctx.data);
			return { controllers: { recentlyViewed: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/recently-viewed",
					component: "RecentlyViewedAdmin",
					label: "Recently Viewed",
					icon: "Eye",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [{ path: "/recently-viewed", component: "RecentlyViewedGrid" }],
		},
		options,
	};
}
