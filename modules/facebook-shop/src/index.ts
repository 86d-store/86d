import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { facebookShopStorage } from "./schema";
import { createFacebookShopController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	Collection,
	FacebookShopController,
	Listing,
} from "./service";

export interface FacebookShopOptions extends ModuleConfig {
	/** Facebook API access token */
	accessToken?: string;
	/** Facebook Page ID */
	pageId?: string;
	/** Facebook catalog ID */
	catalogId?: string;
	/** Meta Commerce Manager account ID */
	commerceAccountId?: string;
	/** Meta app secret for webhook signature verification */
	appSecret?: string;
}

export default function facebookShop(options?: FacebookShopOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		accessToken: options?.accessToken,
		pageId: options?.pageId,
		catalogId: options?.catalogId,
		commerceAccountId: options?.commerceAccountId,
	});

	return {
		id: "facebook-shop",
		version: "0.2.0",
		storage: facebookShopStorage,
		exports: {
			read: ["listingTitle", "listingStatus", "listingSyncStatus"],
		},
		events: {
			emits: [
				"facebook.product.synced",
				"facebook.collection.synced",
				"facebook.order.received",
				"facebook.catalog.synced",
				"facebook.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createFacebookShopController(ctx.data, ctx.events, {
				accessToken: options?.accessToken,
				catalogId: options?.catalogId,
				commerceAccountId: options?.commerceAccountId,
			});
			return { controllers: { facebookShop: controller } };
		},
		endpoints: {
			store: createStoreEndpoints(options?.appSecret),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/facebook-shop",
					component: "FacebookShopAdmin",
					label: "Facebook Shop",
					icon: "Globe",
					group: "Sales",
				},
			],
		},
		options,
	};
}
