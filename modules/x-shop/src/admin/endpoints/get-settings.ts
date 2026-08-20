import { createAdminEndpoint } from "@86d-app/core/api";
import { XApiProvider } from "../../provider";

interface SettingsOptions {
	apiKey?: string | undefined;
	apiSecret?: string | undefined;
	accessToken?: string | undefined;
	refreshToken?: string | undefined;
	merchantId?: string | undefined;
}

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 6)}${"•".repeat(Math.min(key.length - 6, 20))}`;
}

export async function resolveSettings(options: SettingsOptions) {
	const hasCredentials = Boolean(
		options.apiKey && options.apiSecret && options.accessToken,
	);

	let status: "connected" | "not_configured" | "error" = "not_configured";
	let error: string | undefined;
	let username: string | undefined;
	let name: string | undefined;
	let userId: string | undefined;

	if (
		hasCredentials &&
		options.apiKey &&
		options.apiSecret &&
		options.accessToken
	) {
		const provider = new XApiProvider({
			apiKey: options.apiKey,
			apiSecret: options.apiSecret,
			accessToken: options.accessToken,
			refreshToken: options.refreshToken,
		});
		const result = await provider.verifyConnection();
		if (result.ok) {
			status = "connected";
			username = result.username;
			name = result.name;
			userId = result.userId;
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
		name,
		userId,
		merchantId: options.merchantId ?? null,
		apiKey: options.apiKey ? maskKey(options.apiKey) : null,
	};
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/x-shop/settings",
		{ method: "GET" },
		async () => resolveSettings(options),
	);
}
