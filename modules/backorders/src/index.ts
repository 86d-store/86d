import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { backordersStorage } from "./schema";
import { createBackordersController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Backorder,
	BackorderPolicy,
	BackorderStatus,
	BackorderSummary,
	BackordersController,
} from "./service";

export interface BackordersOptions extends ModuleConfig {
	/** Default lead time in days for products without a policy */
	defaultLeadDays?: string;
}

export default function backorders(options?: BackordersOptions): Module {
	return {
		id: "backorders",
		version: "0.0.1",
		storage: backordersStorage,
		requires: ["inventory"],
		exports: {
			read: ["backorderCount", "backorderEligibility"],
		},
		events: {
			emits: [
				"backorder.created",
				"backorder.confirmed",
				"backorder.allocated",
				"backorder.shipped",
				"backorder.delivered",
				"backorder.cancelled",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createBackordersController(ctx.data);
			return { controllers: { backorders: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/backorders",
					component: "BackorderList",
					label: "Backorders",
					icon: "Clock",
					group: "Fulfillment",
				},
				{
					path: "/admin/backorders/policies",
					component: "BackorderPolicies",
					label: "Policies",
					icon: "Shield",
					group: "Fulfillment",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/account/backorders",
					component: "MyBackorders",
				},
			],
		},
		options,
	};
}
