import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { priceListResolveProvider } from "./capabilities";
import { priceListsSchema } from "./schema";
import { createPriceListController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	PriceEntry,
	PriceList,
	PriceListController,
	PriceListStats,
	PriceListStatus,
	ResolvedPrice,
} from "./service";

export interface PriceListsOptions extends ModuleConfig {
	/** Default currency for new price lists (ISO 4217). Default: none. */
	defaultCurrency?: string;
}

export default function priceLists(options?: PriceListsOptions): Module {
	return {
		id: "price-lists",
		version: "0.0.1",
		schema: priceListsSchema,
		capabilities: { provides: [priceListResolveProvider] },
		exports: {
			read: ["activePriceLists", "resolvedPrice", "productPrices"],
		},
		requires: ["products"],
		events: {
			emits: [
				"price-list.created",
				"price-list.updated",
				"price-list.deleted",
				"price-list.status.changed",
				"price-entry.set",
				"price-entry.removed",
				"price-entry.bulk-set",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createPriceListController(ctx.data);
			return { controllers: { priceLists: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [{ path: "/price-lists/:slug", component: "PriceListTable" }],
		},
		admin: {
			pages: [
				{
					path: "/admin/price-lists",
					component: "PriceListAdmin",
					label: "Price Lists",
					icon: "Tags",
					group: "Catalog",
				},
				{
					path: "/admin/price-lists/create",
					component: "PriceListCreate",
				},
				{
					path: "/admin/price-lists/:id",
					component: "PriceListDetail",
				},
			],
		},
		options,
	};
}
