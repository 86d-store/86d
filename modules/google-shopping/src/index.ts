import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { googleShoppingStorage } from "./schema";
import { createGoogleShoppingController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	ChannelOrder,
	ChannelStats,
	FeedDiagnostics,
	FeedSubmission,
	GoogleShoppingController,
	ProductFeedItem,
} from "./service";

export interface GoogleShoppingOptions extends ModuleConfig {
	/** Google Merchant Center ID */
	merchantId?: string;
	/** Google API key */
	apiKey?: string;
	/** Target country code (default: "US") */
	targetCountry?: string;
	/** Content language (default: "en") */
	contentLanguage?: string;
	/** Webhook secret for HMAC-SHA256 signature verification */
	webhookSecret?: string;
}

export default function googleShopping(
	options?: GoogleShoppingOptions,
): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		merchantId: options?.merchantId,
		apiKey: options?.apiKey,
		targetCountry: options?.targetCountry,
		contentLanguage: options?.contentLanguage,
	});

	return {
		id: "google-shopping",
		version: "0.1.0",
		storage: googleShoppingStorage,
		exports: {
			read: ["feedItemTitle", "feedItemStatus", "feedItemPrice"],
		},
		events: {
			emits: [
				"google.product.synced",
				"google.product.disapproved",
				"google.feed.submitted",
				"google.order.received",
				"google.catalog.synced",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createGoogleShoppingController(ctx.data, ctx.events, {
				merchantId: options?.merchantId,
				apiKey: options?.apiKey,
				targetCountry: options?.targetCountry,
				contentLanguage: options?.contentLanguage,
			});
			return { controllers: { "google-shopping": controller } };
		},
		endpoints: {
			store: createStoreEndpoints(options?.webhookSecret),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/google-shopping",
					component: "GoogleShoppingAdmin",
					label: "Google Shopping",
					icon: "Search",
					group: "Sales",
				},
			],
		},
		options,
	};
}
