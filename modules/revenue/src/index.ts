import { acceptCapability } from "@86d-app/core/capabilities";
import { paymentIntentCapability } from "@86d-app/core/commerce-capabilities";
import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { revenueStorage } from "./schema";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	PaymentIntentStatus,
	RevenuePaymentsController,
	RevenueStats,
	RevenueTransaction,
} from "./service";

export interface RevenueOptions extends ModuleConfig {}

export default function revenue(_options?: RevenueOptions): Module {
	return {
		id: "revenue",
		version: "0.0.1",
		storage: revenueStorage,
		capabilities: {
			accepts: [
				acceptCapability(paymentIntentCapability, {
					operations: ["list"],
					optional: true,
				}),
			],
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [
				{
					path: "/account/transactions",
					component: "TransactionHistory",
				},
			],
		},
		admin: {
			pages: [
				{
					path: "/admin/revenue",
					component: "RevenueAdmin",
					label: "Revenue",
					icon: "ChartBar",
					group: "Finance",
				},
			],
		},
	};
}
