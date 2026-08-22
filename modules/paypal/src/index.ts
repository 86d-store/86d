import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type { PayPalPaymentConnectionProviderOptions } from "./connection-provider";

export interface PayPalOptions extends ModuleConfig {
	clientId: string;
	clientSecret: string;
	sandbox?: string | undefined;
	webhookId?: string | undefined;
	connectionId?: string | undefined;
	storeId?: string | undefined;
	verificationKeyReference?: string | undefined;
}

const paypalStorage = { kind: "none" } as const;

export default function paypal(options: PayPalOptions): Module {
	const webhookOpts = {
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		...(options.webhookId != null && { webhookId: options.webhookId }),
		...(options.sandbox != null && { sandbox: options.sandbox }),
		...(options.connectionId != null && { connectionId: options.connectionId }),
		...(options.storeId != null && { storeId: options.storeId }),
		...(options.verificationKeyReference != null && {
			verificationKeyReference: options.verificationKeyReference,
		}),
	};

	return {
		id: "paypal",
		version: "0.0.1",
		storage: paypalStorage,
		events: {
			emits: [
				"paypal.payment.captured",
				"paypal.payment.failed",
				"paypal.refund.created",
				"paypal.webhook.received",
			],
		},
		init: async () => {
			return {};
		},
		endpoints: {
			store: createStoreEndpoints(webhookOpts),
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/paypal",
					component: "PayPalAdmin",
					label: "PayPal",
					icon: "CreditCard",
					group: "Finance",
				},
			],
		},
		options: {
			clientId: options.clientId,
			clientSecret: options.clientSecret,
			sandbox: options.sandbox ?? "",
			webhookId: options.webhookId ?? "",
		},
	};
}
