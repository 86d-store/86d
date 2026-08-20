import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { tiktokShopSchema } from "./schema";
import { createTikTokShopController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	Listing,
	TikTokShopController,
} from "./service";

export interface TikTokShopOptions extends ModuleConfig {
	/** TikTok Shop app key */
	appKey?: string;
	/** TikTok Shop app secret */
	appSecret?: string;
	/** TikTok Shop access token */
	accessToken?: string;
	/** TikTok Shop ID */
	shopId?: string;
	/** Use sandbox environment (default: "true") */
	sandbox?: string;
}

export default function tiktokShop(options?: TikTokShopOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		appKey: options?.appKey,
		appSecret: options?.appSecret,
		accessToken: options?.accessToken,
		shopId: options?.shopId,
		sandbox: options?.sandbox !== "false",
	});

	return {
		id: "tiktok-shop",
		version: "0.2.0",
		schema: tiktokShopSchema,
		exports: {
			read: ["listingTitle", "listingStatus", "listingSyncStatus"],
		},
		events: {
			emits: [
				"tiktok.product.synced",
				"tiktok.product.failed",
				"tiktok.order.received",
				"tiktok.order.shipped",
				"tiktok.catalog.synced",
				"tiktok.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createTikTokShopController(ctx.data, ctx.events, {
				appKey: options?.appKey,
				appSecret: options?.appSecret,
				accessToken: options?.accessToken,
				shopId: options?.shopId,
				sandbox: options?.sandbox !== "false",
			});
			return { controllers: { tiktokShop: controller } };
		},
		endpoints: {
			store: createStoreEndpoints(options?.appSecret),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/tiktok-shop",
					component: "TikTokShopAdmin",
					label: "TikTok Shop",
					icon: "Video",
					group: "Sales",
				},
			],
		},
		options,
	};
}
