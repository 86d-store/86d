import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { etsyStorage } from "./schema";
import { createEtsyController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	ChannelStats,
	EtsyController,
	EtsyListing,
	EtsyOrder,
	EtsyReview,
} from "./service";

export interface EtsyOptions extends ModuleConfig {
	/** Etsy API key (x-api-key) */
	apiKey?: string | undefined;
	/** Etsy Shop ID */
	shopId?: string | undefined;
	/** Etsy OAuth2 access token */
	accessToken?: string | undefined;
	/** Etsy webhook signing secret for HMAC-SHA256 verification */
	webhookSecret?: string | undefined;
}

export default function etsy(options?: EtsyOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		apiKey: options?.apiKey,
		shopId: options?.shopId,
		accessToken: options?.accessToken,
	});

	return {
		id: "etsy",
		version: "0.1.0",
		storage: etsyStorage,
		exports: {
			read: ["listingTitle", "listingStatus", "listingPrice", "listingViews"],
		},
		events: {
			emits: [
				"etsy.listing.synced",
				"etsy.listing.expired",
				"etsy.order.received",
				"etsy.order.shipped",
				"etsy.review.received",
				"etsy.catalog.synced",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createEtsyController(ctx.data, ctx.events, {
				apiKey: options?.apiKey,
				shopId: options?.shopId,
				accessToken: options?.accessToken,
			});
			return { controllers: { etsy: controller } };
		},
		endpoints: {
			store: createStoreEndpoints(options?.webhookSecret),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/etsy",
					component: "EtsyAdmin",
					label: "Etsy",
					icon: "Palette",
					group: "Sales",
				},
			],
		},
		options,
	};
}
