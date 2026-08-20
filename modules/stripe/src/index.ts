import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	createStripePaymentConnectionProvider,
	StripePaymentConnectionProvider,
} from "./connection-provider";
import { StripePaymentProvider } from "./provider";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type { StripePaymentConnectionProviderOptions } from "./connection-provider";
export {
	createStripePaymentConnectionProvider,
	StripePaymentConnectionProvider,
	StripePaymentProvider,
};

export interface StripeOptions extends ModuleConfig {
	/** Stripe secret API key (sk_live_... or sk_test_...) */
	apiKey: string;
	/** Stripe webhook signing secret for signature verification */
	webhookSecret?: string | undefined;
}

const stripeStorage = { kind: "none" } as const;

export default function stripe(options: StripeOptions): Module {
	return {
		id: "stripe",
		version: "0.0.1",
		storage: stripeStorage,
		events: {
			emits: [
				"stripe.payment.succeeded",
				"stripe.payment.failed",
				"stripe.refund.created",
				"stripe.webhook.received",
			],
		},
		init: async () => {
			return {};
		},
		endpoints: {
			store: createStoreEndpoints(
				options.webhookSecret != null
					? { webhookSecret: options.webhookSecret }
					: {},
			),
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/stripe",
					component: "StripeAdmin",
					label: "Stripe",
					icon: "CreditCard",
					group: "Finance",
				},
			],
		},
		options: {
			apiKey: options.apiKey,
			webhookSecret: options.webhookSecret ?? "",
		},
	};
}
