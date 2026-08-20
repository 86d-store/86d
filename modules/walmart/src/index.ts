import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { walmartStorage } from "./schema";
import { createWalmartController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ChannelStats,
	FeedStatus,
	FeedSubmission,
	FeedType,
	FulfillmentType,
	ItemHealth,
	ItemStatus,
	WalmartController,
	WalmartItem,
	WalmartOrder,
	WalmartOrderStatus,
} from "./service";

export interface WalmartOptions extends ModuleConfig {
	/** Walmart API client ID */
	clientId?: string;
	/** Walmart API client secret */
	clientSecret?: string;
	/** Channel type designation provided during onboarding */
	channelType?: string;
	/** Use the Walmart sandbox API instead of production */
	sandbox?: boolean;
}

export default function walmart(options?: WalmartOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		clientId: options?.clientId,
		clientSecret: options?.clientSecret,
		channelType: options?.channelType,
		sandbox: options?.sandbox,
	});

	return {
		id: "walmart",
		version: "0.2.0",
		storage: walmartStorage,
		exports: {
			read: ["itemTitle", "itemStatus", "itemPrice", "walmartItemId"],
		},
		events: {
			emits: [
				"walmart.item.synced",
				"walmart.item.retired",
				"walmart.order.received",
				"walmart.order.shipped",
				"walmart.feed.submitted",
				"walmart.inventory.updated",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createWalmartController(ctx.data, ctx.events, {
				clientId: options?.clientId,
				clientSecret: options?.clientSecret,
				channelType: options?.channelType,
			});
			return { controllers: { walmart: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/walmart",
					component: "WalmartAdmin",
					label: "Walmart",
					icon: "Store",
					group: "Sales",
				},
			],
		},
		options,
	};
}
