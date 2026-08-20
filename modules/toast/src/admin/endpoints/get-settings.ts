import { createAdminEndpoint } from "@86d-app/core/api";
import { ToastPosProvider } from "../../provider";

interface SettingsOptions {
	apiKey?: string | undefined;
	restaurantGuid?: string | undefined;
	sandbox?: boolean | undefined;
}

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/toast/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(options.apiKey && options.restaurantGuid);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let menuCount: number | undefined;

			if (hasCredentials && options.apiKey && options.restaurantGuid) {
				const provider = new ToastPosProvider(
					options.apiKey,
					options.restaurantGuid,
					{ sandbox: options.sandbox },
				);
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "connected";
					menuCount = result.menuCount;
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				configured: hasCredentials,
				sandbox: options.sandbox ?? true,
				menuCount,
				apiKeyMasked: options.apiKey ? maskKey(options.apiKey) : null,
				restaurantGuidMasked: options.restaurantGuid
					? maskKey(options.restaurantGuid)
					: null,
			};
		},
	);
}
