import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { preordersSchema } from "./schema";
import { createPreordersController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	CampaignStatus,
	PaymentType,
	PreorderCampaign,
	PreorderItem,
	PreorderItemStatus,
	PreorderSummary,
	PreordersController,
} from "./service";

export interface PreordersOptions extends ModuleConfig {
	/** Default message shown on preorder campaign pages */
	defaultMessage?: string;
}

export default function preorders(options?: PreordersOptions): Module {
	return {
		id: "preorders",
		version: "0.0.1",
		schema: preordersSchema,
		requires: ["products"],
		exports: {
			read: ["preorderAvailability", "preorderCampaign"],
		},
		events: {
			emits: [
				"preorder.campaign.created",
				"preorder.campaign.activated",
				"preorder.campaign.paused",
				"preorder.campaign.completed",
				"preorder.campaign.cancelled",
				"preorder.placed",
				"preorder.confirmed",
				"preorder.ready",
				"preorder.fulfilled",
				"preorder.cancelled",
				"preorder.customers.notified",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createPreordersController(ctx.data);
			return { controllers: { preorders: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/preorders",
					component: "CampaignList",
					label: "Preorders",
					icon: "CalendarClock",
					group: "Fulfillment",
				},
				{
					path: "/admin/preorders/campaigns/:id",
					component: "CampaignDetail",
					label: "Campaign Detail",
					icon: "CalendarClock",
					group: "Fulfillment",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/preorders",
					component: "CampaignList",
				},
				{
					path: "/preorders/:id",
					component: "CampaignDetail",
				},
				{
					path: "/account/preorders",
					component: "MyPreorders",
				},
			],
		},
		options,
	};
}
