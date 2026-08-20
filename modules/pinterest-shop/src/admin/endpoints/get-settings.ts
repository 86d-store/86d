import { createAdminEndpoint } from "@86d-app/core/api";
import { PinterestApiProvider } from "../../provider";

interface SettingsOptions {
	accessToken?: string | undefined;
	adAccountId?: string | undefined;
	catalogId?: string | undefined;
}

function maskToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 6)}${"•".repeat(Math.min(token.length - 6, 20))}`;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/pinterest-shop/settings",
		{ method: "GET" },
		async () => {
			const accessToken = options.accessToken ?? "";
			const hasCredentials = Boolean(accessToken);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let username: string | undefined;
			let accountType: "BUSINESS" | "PINNER" | undefined;

			if (hasCredentials) {
				const provider = new PinterestApiProvider({
					accessToken,
					adAccountId: options.adAccountId,
					catalogId: options.catalogId,
				});
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "connected";
					username = result.username;
					accountType = result.accountType;
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				configured: hasCredentials,
				username,
				accountType,
				adAccountId: options.adAccountId ?? null,
				catalogId: options.catalogId ?? null,
				accessToken: accessToken ? maskToken(accessToken) : null,
			};
		},
	);
}
