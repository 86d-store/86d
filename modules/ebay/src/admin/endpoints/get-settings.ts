import { createAdminEndpoint } from "@86d-app/core/api";
import { EbayProvider } from "../../provider";

interface SettingsOptions {
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	refreshToken?: string | undefined;
	siteId?: string | undefined;
	currency?: string | undefined;
	sandbox?: boolean | undefined;
}

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

const REQUIRED_SCOPES = [
	"https://api.ebay.com/oauth/api_scope/sell.inventory",
	"https://api.ebay.com/oauth/api_scope/sell.fulfillment",
	"https://api.ebay.com/oauth/api_scope/sell.account",
] as const;

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/ebay/settings",
		{ method: "GET" },
		async () => {
			const clientId = options.clientId ?? "";
			const clientSecret = options.clientSecret ?? "";
			const refreshToken = options.refreshToken ?? "";
			const siteId = options.siteId ?? "EBAY_US";
			const sandbox = Boolean(options.sandbox);

			const hasCredentials = Boolean(clientId && clientSecret && refreshToken);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let missingScopes: string[] = [];
			let mode: "sandbox" | "live" | undefined;

			if (hasCredentials) {
				const provider = new EbayProvider({
					clientId,
					clientSecret,
					refreshToken,
					siteId,
					currency: options.currency,
					sandbox,
				});
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "connected";
					mode = result.mode;
					missingScopes = REQUIRED_SCOPES.filter(
						(scope) => !result.scopes.includes(scope),
					);
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				mode: mode ?? (sandbox ? "sandbox" : "live"),
				missingScopes,
				configured: hasCredentials,
				siteId,
				clientId: clientId ? maskKey(clientId) : null,
				clientSecretMasked: clientSecret ? maskKey(clientSecret) : null,
				refreshTokenMasked: refreshToken ? maskKey(refreshToken) : null,
			};
		},
	);
}
