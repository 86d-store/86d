import { createAdminEndpoint } from "@86d-app/core/api";
import { UberEatsProvider } from "../../provider";

interface SettingsOptions {
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	restaurantId?: string | undefined;
}

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

const REQUIRED_SCOPES = [
	"eats.store",
	"eats.store.status.write",
	"eats.order",
	"eats.store.orders.read",
] as const;

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/uber-eats/settings",
		{ method: "GET" },
		async () => {
			const clientId = options.clientId ?? "";
			const clientSecret = options.clientSecret ?? "";
			const restaurantId = options.restaurantId ?? "";
			const hasCredentials = Boolean(clientId && clientSecret && restaurantId);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let missingScopes: string[] = [];

			if (hasCredentials) {
				const provider = new UberEatsProvider(
					clientId,
					clientSecret,
					restaurantId,
				);
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "connected";
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
				missingScopes,
				configured: hasCredentials,
				clientIdMasked: clientId ? maskKey(clientId) : null,
				clientSecretMasked: clientSecret ? maskKey(clientSecret) : null,
				restaurantIdMasked: restaurantId ? maskKey(restaurantId) : null,
				webhookUrl: "/api/uber-eats/webhook",
			};
		},
	);
}
