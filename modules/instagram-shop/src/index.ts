import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { instagramShopStorage } from "./schema";
import { createInstagramShopController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	InstagramShopController,
	Listing,
} from "./service";

export interface InstagramShopOptions extends ModuleConfig {
	/** Instagram API access token */
	accessToken?: string;
	/** Instagram Business account ID */
	businessId?: string;
	/** Instagram catalog ID */
	catalogId?: string;
	/** Meta Commerce Manager account ID */
	commerceAccountId?: string;
	/** Meta app secret for webhook signature verification */
	appSecret?: string;
}

export default function instagramShop(options?: InstagramShopOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		accessToken: options?.accessToken,
		businessId: options?.businessId,
		catalogId: options?.catalogId,
		commerceAccountId: options?.commerceAccountId,
	});

	return {
		id: "instagram-shop",
		version: "0.2.0",
		storage: instagramShopStorage,
		exports: {
			read: ["listingTitle", "listingStatus", "listingSyncStatus"],
		},
		events: {
			emits: [
				"instagram.product.synced",
				"instagram.product.tagged",
				"instagram.order.received",
				"instagram.catalog.synced",
				"instagram.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createInstagramShopController(ctx.data, ctx.events, {
				accessToken: options?.accessToken,
				catalogId: options?.catalogId,
				commerceAccountId: options?.commerceAccountId,
				businessId: options?.businessId,
			});
			return { controllers: { instagramShop: controller } };
		},
		endpoints: {
			store: createStoreEndpoints(options?.appSecret),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/instagram-shop",
					component: "InstagramShopAdmin",
					label: "Instagram Shop",
					icon: "Camera",
					group: "Sales",
				},
			],
		},
		options,
	};
}
