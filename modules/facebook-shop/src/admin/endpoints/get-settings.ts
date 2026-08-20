import { createAdminEndpoint } from "@86d-app/core/api";
import { MetaCommerceProvider } from "../../provider";

interface SettingsOptions {
	accessToken?: string | undefined;
	pageId?: string | undefined;
	catalogId?: string | undefined;
	commerceAccountId?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/facebook-shop/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(
				options.accessToken &&
					options.pageId &&
					options.catalogId &&
					options.commerceAccountId,
			);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;

			if (
				hasCredentials &&
				options.accessToken &&
				options.catalogId &&
				options.commerceAccountId
			) {
				const provider = new MetaCommerceProvider({
					accessToken: options.accessToken,
					catalogId: options.catalogId,
					commerceAccountId: options.commerceAccountId,
				});
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
				pageId: options.pageId ?? null,
				catalogId: options.catalogId ?? null,
				commerceAccountId: options.commerceAccountId ?? null,
				accessToken: options.accessToken
					? `${options.accessToken.slice(0, 8)}...`
					: null,
			};
		},
	);
}
