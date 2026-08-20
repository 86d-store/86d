import { createAdminEndpoint } from "@86d-app/core/api";
import { WalmartProvider } from "../../provider";

interface SettingsOptions {
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	channelType?: string | undefined;
	sandbox?: boolean | undefined;
}

function maskKey(key: string): string {
	if (key.length <= 12) return "****";
	return `${key.slice(0, 10)}${"•".repeat(Math.min(key.length - 10, 20))}`;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/walmart/settings",
		{ method: "GET" },
		async () => {
			const clientId = options.clientId ?? "";
			const clientSecret = options.clientSecret ?? "";
			const sandbox = Boolean(options.sandbox);
			const hasCredentials = Boolean(clientId && clientSecret);

			let status: "connected" | "not_configured" | "error" = "not_configured";
			let error: string | undefined;
			let mode: "sandbox" | "live" | undefined;

			if (hasCredentials) {
				const provider = new WalmartProvider({
					clientId,
					clientSecret,
					channelType: options.channelType,
					sandbox,
				});
				const result = await provider.verifyConnection();
				if (result.ok) {
					status = "connected";
					mode = result.mode;
				} else {
					status = "error";
					error = result.error;
				}
			}

			return {
				status,
				error,
				mode: mode ?? (sandbox ? "sandbox" : "live"),
				configured: hasCredentials,
				channelType: options.channelType ?? null,
				clientId: clientId ? maskKey(clientId) : null,
			};
		},
	);
}
