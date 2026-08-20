import { createContainedBraintreeWebhook } from "./webhook";

export function createStoreEndpoints(opts: {
	publicKey: string;
	privateKey: string;
}) {
	return {
		"/braintree/webhook": createContainedBraintreeWebhook({
			publicKey: opts.publicKey,
			privateKey: opts.privateKey,
		}),
	};
}
