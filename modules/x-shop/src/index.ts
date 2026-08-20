import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { xShopStorage } from "./schema";
import { createXShopController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ChannelOrder,
	ChannelStats,
	DropStats,
	Listing,
	ProductDrop,
	XShopController,
} from "./service";

export interface XShopOptions extends ModuleConfig {
	/** X/Twitter API key (client ID) */
	apiKey?: string;
	/** X/Twitter API secret (client secret) */
	apiSecret?: string;
	/** OAuth 2.0 user access token */
	accessToken?: string;
	/** OAuth 2.0 refresh token for automatic token renewal */
	refreshToken?: string;
	/** X Commerce merchant ID (optional label) */
	merchantId?: string;
}

export default function xShop(options?: XShopOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		apiKey: options?.apiKey,
		apiSecret: options?.apiSecret,
		accessToken: options?.accessToken,
		refreshToken: options?.refreshToken,
		merchantId: options?.merchantId,
	});

	return {
		id: "x-shop",
		version: "0.2.0",
		storage: xShopStorage,
		exports: {
			read: ["listingTitle", "listingStatus", "listingSyncStatus"],
		},
		events: {
			emits: [
				"x.product.listed",
				"x.product.unlisted",
				"x.order.received",
				"x.drop.launched",
				"x.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createXShopController(ctx.data, ctx.events, {
				apiKey: options?.apiKey,
				apiSecret: options?.apiSecret,
				accessToken: options?.accessToken,
				refreshToken: options?.refreshToken,
			});
			return { controllers: { xShop: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/x-shop",
					component: "XShopAdmin",
					label: "X Shop",
					icon: "MessageSquare",
					group: "Sales",
				},
			],
		},
		options,
	};
}
