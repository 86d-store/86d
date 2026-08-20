import { createAdminEndpoint } from "@86d-app/core/api";
import { GoogleShoppingProvider } from "../../provider";

interface SettingsOptions {
	merchantId?: string | undefined;
	apiKey?: string | undefined;
	targetCountry?: string | undefined;
	contentLanguage?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/google-shopping/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(options.merchantId && options.apiKey);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;

			if (hasCredentials && options.merchantId && options.apiKey) {
				const provider = new GoogleShoppingProvider(
					options.merchantId,
					options.apiKey,
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
				error,
				configured: hasCredentials,
				merchantId: options.merchantId ?? null,
				targetCountry: options.targetCountry ?? "US",
				contentLanguage: options.contentLanguage ?? "en",
				apiKey: options.apiKey ? `${options.apiKey.slice(0, 8)}...` : null,
			};
		},
	);
}
