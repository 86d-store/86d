import { createAdminEndpoint } from "@86d-app/core/api";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

interface SettingsOptions {
	apiKey?: string | undefined;
	merchantId?: string | undefined;
	sandbox?: boolean | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/favor/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(options.apiKey && options.merchantId);

			const status: "configured" | "not_configured" = hasCredentials
				? "configured"
				: "not_configured";

			return {
				status,
				configured: hasCredentials,
				sandbox: options.sandbox ?? true,
				apiKeyMasked: options.apiKey ? maskKey(options.apiKey) : null,
				merchantIdMasked: options.merchantId
					? maskKey(options.merchantId)
					: null,
			};
		},
	);
}
