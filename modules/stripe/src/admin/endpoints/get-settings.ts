import { createAdminEndpoint } from "@86d-app/core/api";
import { StripePaymentProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

function str(val: unknown): string {
	return typeof val === "string" ? val : "";
}

export const getSettings = createAdminEndpoint(
	"/admin/stripe/settings",
	{ method: "GET" },
	async (ctx) => {
		// Module options are flat key-value pairs at runtime
		const opts = ctx.context.options as Record<string, unknown>;
		const apiKey = str(opts.apiKey);
		const webhookSecret = str(opts.webhookSecret);
		const webhookVerificationConfigured = webhookSecret.length > 0;

		let status: "connected" | "not_configured" | "error" = "not_configured";
		let error: string | undefined;
		let accountName: string | undefined;

		if (apiKey.length > 0 && webhookVerificationConfigured) {
			const provider = new StripePaymentProvider(apiKey);
			const result = await provider.verifyConnection();
			if (result.ok) {
				status = "connected";
				accountName = result.accountName;
			} else {
				status = "error";
				error = result.error;
			}
		}

		return {
			status,
			ready: status === "connected" && webhookVerificationConfigured,
			error,
			accountName,
			apiKeyMasked: apiKey ? maskKey(apiKey) : null,
			apiKeyMode: apiKey.startsWith("sk_live_")
				? "live"
				: apiKey.startsWith("sk_test_")
					? "test"
					: "unknown",
			webhookSecretConfigured: webhookVerificationConfigured,
			webhookSecretMasked: webhookSecret ? maskKey(webhookSecret) : null,
		};
	},
);
