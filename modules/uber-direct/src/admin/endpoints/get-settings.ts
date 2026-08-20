import { createAdminEndpoint } from "@86d-app/core/api";
import { UberDirectProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

interface SettingsOptions {
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	customerId?: string | undefined;
	webhookSigningKey?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/uber-direct/settings",
		{ method: "GET" },
		async () => {
			const apiConfigured = Boolean(
				options.clientId && options.clientSecret && options.customerId,
			);
			const webhookConfigured = Boolean(options.webhookSigningKey);
			const hasCredentials = apiConfigured && webhookConfigured;

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let accountName: string | undefined;

			if (hasCredentials) {
				const provider = new UberDirectProvider({
					clientId: options.clientId ?? "",
					clientSecret: options.clientSecret ?? "",
					customerId: options.customerId ?? "",
				});
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
				error,
				accountName,
				configured: hasCredentials,
				apiConfigured,
				webhookConfigured,
				clientIdMasked: options.clientId ? maskKey(options.clientId) : null,
				customerIdMasked: options.customerId
					? maskKey(options.customerId)
					: null,
			};
		},
	);
}
