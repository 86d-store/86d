import { createDurablePayPalWebhook } from "./webhook";

export function createStoreEndpoints(opts: {
	clientId: string;
	clientSecret: string;
	webhookId?: string;
	sandbox?: string;
	connectionId?: string;
	storeId?: string;
	verificationKeyReference?: string;
}) {
	return {
		"/paypal/webhook": createDurablePayPalWebhook({
			clientId: opts.clientId,
			clientSecret: opts.clientSecret,
			webhookId: opts.webhookId,
			sandbox: opts.sandbox,
			connectionId: opts.connectionId,
			storeId: opts.storeId,
			verificationKeyReference: opts.verificationKeyReference,
		}),
	};
}
