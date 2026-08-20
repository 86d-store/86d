import { createContainedStripeWebhook } from "./webhook";

export function createStoreEndpoints(opts?: { webhookSecret?: string }) {
	return {
		"/stripe/webhook": createContainedStripeWebhook({
			webhookSecret: opts?.webhookSecret,
		}),
	};
}
