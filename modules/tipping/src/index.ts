import { acceptCapability } from "@86d-app/core/capabilities";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { tippingStorage } from "./schema";
import { createTippingController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Tip,
	TipPayout,
	TippingController,
	TipSettings,
	TipStats,
} from "./service";

export interface TippingOptions extends ModuleConfig {
	/** Comma-separated default tip percentages (default: "15,18,20,25") */
	defaultPercents?: string;
	/** Allow custom tip amounts (default: "true") */
	allowCustomAmount?: string;
	/** Maximum tip percentage allowed (default: "100") */
	maxTipPercent?: string;
	/** Enable tip splitting (default: "false") */
	enableTipSplitting?: string;
}

export default function tipping(options?: TippingOptions): Module {
	return {
		id: "tipping",
		version: "0.1.0",
		storage: tippingStorage,
		capabilities: {
			accepts: [
				acceptCapability(orderCustomerAuthorizeCapability, { optional: true }),
			],
		},
		exports: {
			read: ["tipTotal", "tipSettings"],
		},
		events: {
			emits: [
				"tip.added",
				"tip.updated",
				"tip.removed",
				"tip.split",
				"tip.payout.created",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createTippingController(ctx.data);
			return { controllers: { tipping: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/tipping",
					component: "TippingAdmin",
					label: "Tipping",
					icon: "Heart",
					group: "Sales",
				},
				{
					path: "/admin/tipping/payouts",
					component: "TipPayouts",
					label: "Tip Payouts",
					icon: "Wallet",
					group: "Sales",
				},
			],
		},
		options,
	};
}
