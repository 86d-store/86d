import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	BraintreePaymentConnectionProvider,
	createBraintreePaymentConnectionProvider,
} from "./connection-provider";
import { BraintreePaymentProvider } from "./provider";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type { BraintreePaymentConnectionProviderOptions } from "./connection-provider";
export {
	BraintreePaymentConnectionProvider,
	BraintreePaymentProvider,
	createBraintreePaymentConnectionProvider,
};

export interface BraintreeOptions extends ModuleConfig {
	merchantId: string;
	publicKey: string;
	privateKey: string;
	sandbox?: string | undefined;
}

export default function braintree(options: BraintreeOptions): Module {
	return {
		id: "braintree",
		version: "0.0.1",
		schema: {},
		events: {
			emits: [
				"braintree.payment.settled",
				"braintree.payment.failed",
				"braintree.refund.created",
				"braintree.webhook.received",
			],
		},
		init: async () => {
			return {};
		},
		endpoints: {
			store: createStoreEndpoints({
				publicKey: options.publicKey,
				privateKey: options.privateKey,
			}),
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/braintree",
					component: "BraintreeAdmin",
					label: "Braintree",
					icon: "CreditCard",
					group: "Finance",
				},
			],
		},
		options: {
			merchantId: options.merchantId,
			publicKey: options.publicKey,
			privateKey: options.privateKey,
			sandbox: options.sandbox ?? "",
		},
	};
}
