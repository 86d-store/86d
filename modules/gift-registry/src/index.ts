import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { giftRegistryStorage } from "./schema";
import { createGiftRegistryController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface GiftRegistryOptions extends ModuleConfig {
	/** Maximum registries per customer (0 = unlimited) */
	maxRegistriesPerCustomer?: number;
}

export default function giftRegistry(options?: GiftRegistryOptions): Module {
	return {
		id: "gift-registry",
		version: "0.0.1",
		storage: giftRegistryStorage,

		exports: {
			read: ["registryStatus", "registryItemCount", "registryProgress"],
		},

		events: {
			emits: [
				"registry.created",
				"registry.updated",
				"registry.archived",
				"registry.completed",
				"registry.deleted",
				"registry.item_added",
				"registry.item_removed",
				"registry.item_purchased",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createGiftRegistryController(ctx.data);
			return {
				controllers: { giftRegistry: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/gift-registry",
					component: "RegistriesList",
					label: "Gift Registries",
					icon: "Gift",
					group: "Sales",
				},
				{
					path: "/admin/gift-registry/:id",
					component: "RegistryDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/gift-registry",
					component: "RegistryBrowse",
				},
				{
					path: "/gift-registry/:slug",
					component: "RegistryPage",
				},
			],
		},

		options,
	};
}

export type {
	GiftRegistryController,
	ItemPriority,
	Registry,
	RegistryItem,
	RegistryPurchase,
	RegistryStatus,
	RegistrySummary,
	RegistryType,
	RegistryVisibility,
} from "./service";
