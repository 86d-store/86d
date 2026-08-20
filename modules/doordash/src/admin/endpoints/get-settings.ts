import { createAdminEndpoint } from "@86d-app/core/api";
import { DoordashDriveProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 8)}${"*".repeat(Math.min(key.length - 8, 20))}`;
}

interface SettingsOptions {
	developerId?: string | undefined;
	keyId?: string | undefined;
	signingSecret?: string | undefined;
	sandbox?: boolean | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/doordash/settings",
		{ method: "GET" },
		async () => {
			const apiConfigured = Boolean(
				options.developerId && options.keyId && options.signingSecret,
			);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let accountName: string | undefined;

			if (apiConfigured) {
				const provider = new DoordashDriveProvider(
					{
						developerId: options.developerId ?? "",
						keyId: options.keyId ?? "",
						signingSecret: options.signingSecret ?? "",
					},
					options.sandbox ?? true,
				);
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "error";
					accountName = result.accountName;
					error =
						"DoorDash webhook ingress is disabled until documented webhook authentication is configured.";
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				accountName,
				configured: false,
				apiConfigured,
				webhookConfigured: false,
				webhookStatus: "disabled",
				sandbox: options.sandbox ?? true,
				developerIdMasked: options.developerId
					? maskKey(options.developerId)
					: null,
				keyIdMasked: options.keyId ? maskKey(options.keyId) : null,
			};
		},
	);
}
