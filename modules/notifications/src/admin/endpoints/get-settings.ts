import { createAdminEndpoint } from "@86d-app/core/api";
import { ResendProvider, TwilioProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

interface SettingsOptions {
	resendApiKey?: string | undefined;
	resendFromAddress?: string | undefined;
	resendWebhookSecret?: string | undefined;
	twilioAccountSid?: string | undefined;
	twilioAuthToken?: string | undefined;
	twilioFromNumber?: string | undefined;
	twilioStatusCallbackUrl?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/notifications/settings",
		{ method: "GET" },
		async () => {
			const emailConfigured = Boolean(
				options.resendApiKey && options.resendFromAddress,
			);
			const smsConfigured = Boolean(
				options.twilioAccountSid &&
					options.twilioAuthToken &&
					options.twilioFromNumber,
			);

			let emailStatus: "connected" | "not_configured" | "error" =
				"not_configured";
			let emailError: string | undefined;
			let emailAccountName: string | undefined;

			if (emailConfigured) {
				const resend = new ResendProvider(
					options.resendApiKey ?? "",
					options.resendFromAddress ?? "",
				);
				const result = await resend.verifyConnection();
				if (result.ok) {
					emailStatus = "connected";
					emailAccountName = result.accountName;
				} else {
					emailStatus = "error";
					emailError = result.error;
				}
			}

			let smsStatus: "connected" | "not_configured" | "error" =
				"not_configured";
			let smsError: string | undefined;
			let smsAccountName: string | undefined;

			if (smsConfigured) {
				const twilio = new TwilioProvider(
					options.twilioAccountSid ?? "",
					options.twilioAuthToken ?? "",
					options.twilioFromNumber ?? "",
				);
				const result = await twilio.verifyConnection();
				if (result.ok) {
					smsStatus = "connected";
					smsAccountName = result.accountName;
				} else {
					smsStatus = "error";
					smsError = result.error;
				}
			}

			return {
				email: {
					status: emailStatus,
					error: emailError,
					accountName: emailAccountName,
					configured: emailConfigured,
					provider: "resend",
					fromAddress: options.resendFromAddress ?? null,
					apiKeyMasked: options.resendApiKey
						? maskKey(options.resendApiKey)
						: null,
					webhookConfigured: Boolean(options.resendWebhookSecret),
				},
				sms: {
					status: smsStatus,
					error: smsError,
					accountName: smsAccountName,
					configured: smsConfigured,
					provider: "twilio",
					fromNumber: options.twilioFromNumber ?? null,
					accountSidMasked: options.twilioAccountSid
						? maskKey(options.twilioAccountSid)
						: null,
					webhookConfigured: Boolean(
						options.twilioStatusCallbackUrl && options.twilioAuthToken,
					),
					statusCallbackUrl: options.twilioStatusCallbackUrl ?? null,
				},
			};
		},
	);
}
