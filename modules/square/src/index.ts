import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { SquarePaymentProvider } from "./provider";
import { createStoreEndpoints } from "./store/endpoints/routes";

export { SquarePaymentProvider };

export interface SquareOptions extends ModuleConfig {
	accessToken: string;
	webhookSignatureKey?: string | undefined;
	webhookNotificationUrl?: string | undefined;
}

export default function square(options: SquareOptions): Module {
	const webhookOpts =
		options.webhookSignatureKey != null ||
		options.webhookNotificationUrl != null
			? {
					...(options.webhookSignatureKey != null && {
						webhookSignatureKey: options.webhookSignatureKey,
					}),
					...(options.webhookNotificationUrl != null && {
						webhookNotificationUrl: options.webhookNotificationUrl,
					}),
				}
			: undefined;

	return {
		id: "square",
		version: "0.0.1",
		schema: {},
		events: {
			emits: [
				"square.payment.completed",
				"square.payment.failed",
				"square.refund.created",
				"square.webhook.received",
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
					path: "/admin/square",
					component: "SquareAdmin",
					label: "Square",
					icon: "CreditCard",
					group: "Finance",
				},
			],
		},
		options: {
			accessToken: options.accessToken,
			webhookSignatureKey: options.webhookSignatureKey ?? "",
			webhookNotificationUrl: options.webhookNotificationUrl ?? "",
		},
	};
}
