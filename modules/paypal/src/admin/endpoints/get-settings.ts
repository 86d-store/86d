import { createAdminEndpoint } from "@86d-app/core/api";
import { PayPalPaymentProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

function str(val: unknown): string {
	return typeof val === "string" ? val : "";
}

export const getSettings = createAdminEndpoint(
	"/admin/paypal/settings",
	{ method: "GET" },
	async (ctx) => {
		// Module options are flat key-value pairs at runtime
		const opts = ctx.context.options as Record<string, unknown>;
		const clientId = str(opts.clientId);
		const clientSecret = str(opts.clientSecret);
		const sandbox = str(opts.sandbox);
		const webhookId = str(opts.webhookId);
		const webhookVerificationConfigured = webhookId.length > 0;

		const isSandbox = sandbox === "true" || sandbox === "1";

		let status: "connected" | "not_configured" | "error" = "not_configured";
		let error: string | undefined;

		if (
			clientId.length > 0 &&
			clientSecret.length > 0 &&
			webhookVerificationConfigured
		) {
			const provider = new PayPalPaymentProvider(
				clientId,
				clientSecret,
				isSandbox,
			);
			const result = await provider.verifyConnection();
			if (result.ok) {
				status = "connected";
			} else {
				status = "error";
				error = result.error;
			}
		}

		return {
			status,
			ready: status === "connected" && webhookVerificationConfigured,
			error,
			clientIdMasked: clientId ? maskKey(clientId) : null,
			clientSecretMasked: clientSecret ? maskKey(clientSecret) : null,
			mode: isSandbox ? ("sandbox" as const) : ("live" as const),
			webhookIdConfigured: webhookVerificationConfigured,
			webhookIdMasked: webhookId ? maskKey(webhookId) : null,
		};
	},
);
