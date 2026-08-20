import { deleteNotificationEndpoint } from "./delete-notification";
import { getNotificationEndpoint } from "./get-notification";
import { getPreferencesEndpoint } from "./get-preferences";
import { listMyNotificationsEndpoint } from "./list-my-notifications";
import { markAllReadEndpoint } from "./mark-all-read";
import { markReadEndpoint } from "./mark-read";
import { createResendWebhook } from "./resend-webhook";
import { createTwilioWebhook } from "./twilio-webhook";
import { unreadCountEndpoint } from "./unread-count";
import { updatePreferencesEndpoint } from "./update-preferences";

export interface NotificationsWebhookOptions {
	resendWebhookSecret?: string | undefined;
	twilioAuthToken?: string | undefined;
	twilioWebhookUrl?: string | undefined;
}

export function createStoreEndpoints(opts: NotificationsWebhookOptions = {}) {
	return {
		"/notifications": listMyNotificationsEndpoint,
		"/notifications/read-all": markAllReadEndpoint,
		"/notifications/unread-count": unreadCountEndpoint,
		"/notifications/preferences": getPreferencesEndpoint,
		"/notifications/preferences/update": updatePreferencesEndpoint,
		"/notifications/:id": getNotificationEndpoint,
		"/notifications/:id/read": markReadEndpoint,
		"/notifications/:id/delete": deleteNotificationEndpoint,
		"/notifications/webhook/resend": createResendWebhook({
			webhookSecret: opts.resendWebhookSecret,
		}),
		"/notifications/webhook/twilio": createTwilioWebhook({
			authToken: opts.twilioAuthToken,
			webhookUrl: opts.twilioWebhookUrl,
		}),
	};
}

export const storeEndpoints = createStoreEndpoints();
