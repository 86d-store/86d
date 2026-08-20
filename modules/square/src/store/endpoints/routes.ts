import { createContainedSquareWebhook } from "./webhook";

export function createStoreEndpoints(opts?: {
	webhookSignatureKey?: string;
	webhookNotificationUrl?: string;
}) {
	return {
		"/square/webhook": createContainedSquareWebhook({
			webhookSignatureKey: opts?.webhookSignatureKey,
			notificationUrl: opts?.webhookNotificationUrl ?? "",
		}),
	};
}
