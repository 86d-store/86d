import { createAdminEndpoint } from "@86d-app/core/api";
import { SquarePaymentProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

function str(val: unknown): string {
	return typeof val === "string" ? val : "";
}

export const getSettings = createAdminEndpoint(
	"/admin/square/settings",
	{ method: "GET" },
	async (ctx) => {
		// Module options are flat key-value pairs at runtime
		const opts = ctx.context.options as Record<string, unknown>;
		const accessToken = str(opts.accessToken);
		const webhookSignatureKey = str(opts.webhookSignatureKey);
		const webhookNotificationUrl = str(opts.webhookNotificationUrl);
		const webhookVerificationConfigured =
			webhookSignatureKey.length > 0 && webhookNotificationUrl.length > 0;

		let status: "connected" | "not_configured" | "error" = "not_configured";
		let error: string | undefined;
		let locationCount: number | undefined;

		if (accessToken.length > 0 && webhookVerificationConfigured) {
			const provider = new SquarePaymentProvider(accessToken);
			const result = await provider.verifyConnection();
			if (result.ok) {
				status = "connected";
				locationCount = result.locationCount;
			} else {
				status = "error";
				error = result.error;
			}
		}

		return {
			status,
			ready: status === "connected" && webhookVerificationConfigured,
			error,
			locationCount,
			accessTokenMasked: accessToken ? maskKey(accessToken) : null,
			webhookSignatureConfigured: webhookVerificationConfigured,
			webhookSignatureKeyMasked: webhookSignatureKey
				? maskKey(webhookSignatureKey)
				: null,
			webhookNotificationUrl: webhookNotificationUrl || null,
		};
	},
);
