import { createAdminEndpoint } from "@86d-app/core/api";
import { TaxJarProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

interface SettingsOptions {
	taxjarApiKey?: string | undefined;
	taxjarSandbox?: boolean | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/tax/settings",
		{ method: "GET" },
		async () => {
			const apiKey = options.taxjarApiKey ?? "";
			const hasCredentials = apiKey.length > 0;

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let accountName: string | undefined;

			if (hasCredentials) {
				const provider = new TaxJarProvider(
					apiKey,
					options.taxjarSandbox ?? false,
				);
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
				sandbox: options.taxjarSandbox ?? false,
				apiKeyMasked: hasCredentials ? maskKey(apiKey) : null,
			};
		},
	);
}
