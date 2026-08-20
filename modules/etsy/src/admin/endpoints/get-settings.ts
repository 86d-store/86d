import { createAdminEndpoint } from "@86d-app/core/api";
import { EtsyProvider } from "../../provider";

interface SettingsOptions {
	apiKey?: string | undefined;
	shopId?: string | undefined;
	accessToken?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/etsy/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(
				options.apiKey && options.shopId && options.accessToken,
			);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;

			if (
				hasCredentials &&
				options.apiKey &&
				options.shopId &&
				options.accessToken
			) {
				const provider = new EtsyProvider(
					options.apiKey,
					options.shopId,
					options.accessToken,
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
				shopId: options.shopId ?? null,
				apiKey: options.apiKey ? `${options.apiKey.slice(0, 8)}...` : null,
			};
		},
	);
}
