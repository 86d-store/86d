import { createAdminEndpoint } from "@86d-app/core/api";
import { AmazonProvider } from "../../provider";

interface SettingsOptions {
	sellerId?: string | undefined;
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	refreshToken?: string | undefined;
	marketplaceId?: string | undefined;
	region?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/amazon/settings",
		{ method: "GET" },
		async () => {
			const apiConfigured = Boolean(
				options.sellerId &&
					options.clientId &&
					options.clientSecret &&
					options.refreshToken,
			);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;

			if (
				apiConfigured &&
				options.sellerId &&
				options.clientId &&
				options.clientSecret &&
				options.refreshToken
			) {
				const provider = new AmazonProvider({
					sellerId: options.sellerId,
					clientId: options.clientId,
					clientSecret: options.clientSecret,
					refreshToken: options.refreshToken,
					marketplaceId: options.marketplaceId ?? "ATVPDKIKX0DER",
					region: options.region,
				});
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "error";
					error =
						"Amazon SP-API notification ingestion is disabled until an SQS or EventBridge consumer is configured.";
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				configured: false,
				apiConfigured,
				notificationStatus: "disabled",
				sellerId: options.sellerId ?? null,
				marketplaceId: options.marketplaceId ?? null,
				region: options.region ?? "NA",
				clientId: options.clientId
					? `${options.clientId.slice(0, 12)}...`
					: null,
			};
		},
	);
}
