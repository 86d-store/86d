import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { subscriptionsStorage } from "./schema";
import { createSubscriptionController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Subscription,
	SubscriptionController,
	SubscriptionInterval,
	SubscriptionPlan,
	SubscriptionStatus,
} from "./service";

export interface SubscriptionsOptions extends ModuleConfig {
	/** Default currency for plans */
	currency?: string;
}

export default function subscriptions(options?: SubscriptionsOptions): Module {
	return {
		id: "subscriptions",
		version: "0.0.1",
		storage: subscriptionsStorage,
		exports: {
			read: ["subscriptionStatus", "subscriptionPlan"],
		},
		events: {
			emits: [
				"subscription.created",
				"subscription.renewed",
				"subscription.cancelled",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSubscriptionController(ctx.data, ctx.events);
			return { controllers: { subscriptions: controller } };
		},
		search: { store: "/subscriptions/store-search" },
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/subscriptions",
					component: "SubscriptionsAdmin",
					label: "Subscriptions",
					icon: "Calendar",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/subscriptions",
					component: "SubscriptionPlans",
				},
			],
		},
		options,
	};
}
