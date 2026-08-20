import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { pinterestShopSchema } from "./schema";
import { createPinterestShopController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Availability,
	CatalogItem,
	CatalogItemStatus,
	CatalogSync,
	ChannelStats,
	PinAnalytics,
	PinterestShopController,
	ShoppingPin,
	SyncStatus,
} from "./service";

export interface PinterestShopOptions extends ModuleConfig {
	/** Pinterest API access token */
	accessToken?: string;
	/** Pinterest ad account ID */
	adAccountId?: string;
	/** Pinterest catalog ID */
	catalogId?: string;
}

export default function pinterestShop(options?: PinterestShopOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		accessToken: options?.accessToken,
		adAccountId: options?.adAccountId,
		catalogId: options?.catalogId,
	});

	return {
		id: "pinterest-shop",
		version: "0.2.0",
		schema: pinterestShopSchema,
		exports: {
			read: [
				"catalogItemTitle",
				"catalogItemStatus",
				"catalogItemPrice",
				"pinterestItemId",
			],
		},
		events: {
			emits: [
				"pinterest.product.synced",
				"pinterest.pin.created",
				"pinterest.order.received",
				"pinterest.catalog.synced",
				"pinterest.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createPinterestShopController(
				ctx.data,
				ctx.events,
				options?.accessToken
					? {
							accessToken: options.accessToken,
							adAccountId: options.adAccountId,
							catalogId: options.catalogId,
						}
					: undefined,
			);
			return { controllers: { pinterestShop: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/pinterest-shop",
					component: "PinterestShopAdmin",
					label: "Pinterest Shop",
					icon: "Pin",
					group: "Sales",
				},
			],
		},
		options,
	};
}
