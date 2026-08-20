import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { amazonSchema } from "./schema";
import { createAmazonController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	AmazonController,
	AmazonOrder,
	ChannelStats,
	InventoryHealth,
	InventorySync,
	Listing,
} from "./service";

export interface AmazonOptions extends ModuleConfig {
	/** Amazon Seller ID (required for SP-API) */
	sellerId?: string;
	/** LWA OAuth2 Client ID */
	clientId?: string;
	/** LWA OAuth2 Client Secret */
	clientSecret?: string;
	/** LWA OAuth2 Refresh Token (obtained when seller authorizes your app) */
	refreshToken?: string;
	/** Amazon Marketplace ID (e.g. ATVPDKIKX0DER for US) */
	marketplaceId?: string;
	/** Amazon region: "NA" | "EU" | "FE" (default: "NA") */
	region?: string;
	/** @deprecated SP-API HTTP webhook ingress is disabled. */
	webhookSecret?: string;
}

export default function amazon(options?: AmazonOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		sellerId: options?.sellerId,
		clientId: options?.clientId,
		clientSecret: options?.clientSecret,
		refreshToken: options?.refreshToken,
		marketplaceId: options?.marketplaceId,
		region: options?.region,
	});

	return {
		id: "amazon",
		version: "0.2.0",
		schema: amazonSchema,
		exports: {
			read: ["listingTitle", "listingSku", "listingStatus", "listingPrice"],
		},
		events: {
			emits: [
				"amazon.listing.synced",
				"amazon.listing.suppressed",
				"amazon.order.received",
				"amazon.order.shipped",
				"amazon.inventory.updated",
				"amazon.feed.submitted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createAmazonController(ctx.data, ctx.events, {
				sellerId: options?.sellerId,
				clientId: options?.clientId,
				clientSecret: options?.clientSecret,
				refreshToken: options?.refreshToken,
				marketplaceId: options?.marketplaceId,
				region: options?.region,
			});
			return { controllers: { amazon: controller } };
		},
		endpoints: {
			store: createStoreEndpoints(),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/amazon",
					component: "AmazonAdmin",
					label: "Amazon",
					icon: "Package",
					group: "Sales",
				},
				{
					path: "/admin/amazon/inventory",
					component: "AmazonInventory",
					label: "Amazon Inventory",
					icon: "Warehouse",
					group: "Sales",
				},
			],
		},
		options,
	};
}
