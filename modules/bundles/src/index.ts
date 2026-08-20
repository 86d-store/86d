import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { bundleSchema } from "./schema";
import { createBundleController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Bundle,
	BundleController,
	BundleItem,
	BundleWithItems,
} from "./service";

export interface BundleOptions extends ModuleConfig {
	/** Maximum number of items allowed per bundle (default: 20) */
	maxItemsPerBundle?: number;
	/** Maximum discount percentage allowed (default: 100) */
	maxDiscountPercentage?: number;
}

export default function bundles(options?: BundleOptions): Module {
	return {
		id: "bundles",
		version: "0.0.1",
		schema: bundleSchema,
		requires: {
			products: { read: ["productTitle", "productPrice"] },
		},
		exports: {
			read: ["bundlePrice", "bundleItems"],
		},
		events: {
			emits: [
				"bundle.created",
				"bundle.updated",
				"bundle.activated",
				"bundle.archived",
				"bundle.itemAdded",
				"bundle.itemRemoved",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createBundleController(ctx.data);
			return { controllers: { bundles: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/bundles",
					component: "BundleOverview",
					label: "Bundles",
					icon: "Package",
					group: "Catalog",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/bundles",
					component: "BundleList",
				},
				{
					path: "/bundles/:slug",
					component: "BundleDetail",
				},
			],
		},
		options,
	};
}
