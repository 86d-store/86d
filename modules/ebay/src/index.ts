import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { ebayStorage } from "./schema";
import { createEbayController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ChannelStats,
	EbayController,
	EbayListing,
	EbayOrder,
	EbayOrderStatus,
	ListingCondition,
	ListingStatus,
	ListingType,
} from "./service";

export interface EbayOptions extends ModuleConfig {
	/** eBay API client ID */
	clientId?: string;
	/** eBay API client secret */
	clientSecret?: string;
	/** eBay API refresh token */
	refreshToken?: string;
	/** eBay site ID (default: "EBAY_US") */
	siteId?: string;
	/** Listing currency code (default: "USD") */
	currency?: string;
	/** Use the eBay Sandbox environment instead of production */
	sandbox?: boolean;
}

export default function ebay(options?: EbayOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		clientId: options?.clientId,
		clientSecret: options?.clientSecret,
		refreshToken: options?.refreshToken,
		siteId: options?.siteId,
		currency: options?.currency,
		sandbox: options?.sandbox,
	});

	return {
		id: "ebay",
		version: "0.2.0",
		storage: ebayStorage,
		exports: {
			read: ["listingTitle", "listingStatus", "listingPrice", "ebayItemId"],
		},
		events: {
			emits: [
				"ebay.listing.created",
				"ebay.listing.ended",
				"ebay.order.received",
				"ebay.order.shipped",
				"ebay.bid.received",
				"ebay.catalog.synced",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createEbayController(ctx.data, ctx.events, {
				clientId: options?.clientId,
				clientSecret: options?.clientSecret,
				refreshToken: options?.refreshToken,
				siteId: options?.siteId,
				currency: options?.currency,
				sandbox: options?.sandbox,
			});
			return { controllers: { ebay: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/ebay",
					component: "EbayAdmin",
					label: "eBay",
					icon: "Tag",
					group: "Sales",
				},
			],
		},
		options,
	};
}
