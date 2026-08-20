import { createAdminEndpoint } from "@86d-app/core/api";
import { TikTokShopProvider } from "../../provider";

interface SettingsOptions {
	appKey?: string | undefined;
	appSecret?: string | undefined;
	accessToken?: string | undefined;
	shopId?: string | undefined;
	sandbox?: boolean | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/tiktok-shop/settings",
		{ method: "GET" },
		async () => {
			const hasCredentials = Boolean(
				options.appKey &&
					options.appSecret &&
					options.accessToken &&
					options.shopId,
			);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;

			if (
				hasCredentials &&
				options.appKey &&
				options.appSecret &&
				options.accessToken &&
				options.shopId
			) {
				const provider = new TikTokShopProvider({
					appKey: options.appKey,
					appSecret: options.appSecret,
					accessToken: options.accessToken,
					shopId: options.shopId,
					sandbox: options.sandbox,
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
				shopId: options.shopId ?? null,
				sandbox: options.sandbox ?? true,
				appKey: options.appKey ? `${options.appKey.slice(0, 8)}...` : null,
			};
		},
	);
}
