import { createAdminEndpoint } from "@86d-app/core/api";
import type { ShippingConnection } from "../../foundation-v2";
import { EasyPostProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

function isOriginConfigured(connection: ShippingConnection | null): boolean {
	if (!connection) return false;
	const { street1, city, state, postalCode, country } =
		connection.originAddress;
	return Boolean(street1 && city && state && postalCode && country);
}

interface SettingsOptions {
	easypostApiKey?: string | undefined;
	easypostTestMode?: boolean | undefined;
	easypostWebhookSecret?: string | undefined;
	easypostConnectionId?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	const connectionId =
		options.easypostConnectionId ?? "shipping_easypost_default";
	return createAdminEndpoint(
		"/admin/shipping/settings",
		{ method: "GET" },
		async (ctx) => {
			const apiKey = options.easypostApiKey ?? "";
			const webhookSecret = options.easypostWebhookSecret ?? "";
			const apiConfigured = apiKey.length > 0;
			const webhookConfigured = webhookSecret.length > 0;
			const hasCredentials = apiConfigured && webhookConfigured;

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let accountName: string | undefined;

			if (hasCredentials) {
				const provider = new EasyPostProvider(
					apiKey,
					options.easypostTestMode ?? true,
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

			const foundation = ctx.context?.controllers?.shippingV2 as
				| { getConnection(id: string): Promise<ShippingConnection | null> }
				| undefined;
			const connection = foundation
				? await foundation.getConnection(connectionId)
				: null;

			return {
				status,
				error,
				accountName,
				configured: hasCredentials,
				apiConfigured,
				testMode: options.easypostTestMode ?? true,
				apiKeyMasked: apiConfigured ? maskKey(apiKey) : null,
				webhookConfigured,
				webhookSecretMasked:
					webhookSecret.length > 0 ? maskKey(webhookSecret) : null,
				originConfigured: isOriginConfigured(connection),
			};
		},
	);
}
