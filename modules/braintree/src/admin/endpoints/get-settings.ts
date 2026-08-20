import { createAdminEndpoint } from "@86d-app/core/api";
import { BraintreePaymentProvider } from "../../provider";

function maskKey(key: string): string {
	if (key.length <= 8) return "****";
	return `${key.slice(0, 7)}${"*".repeat(Math.min(key.length - 7, 20))}`;
}

function str(val: unknown): string {
	return typeof val === "string" ? val : "";
}

export const getSettings = createAdminEndpoint(
	"/admin/braintree/settings",
	{ method: "GET" },
	async (ctx) => {
		// Module options are flat key-value pairs at runtime
		const opts = ctx.context.options as Record<string, unknown>;
		const merchantId = str(opts.merchantId);
		const publicKey = str(opts.publicKey);
		const privateKey = str(opts.privateKey);
		const sandbox = str(opts.sandbox);

		const isSandbox = sandbox === "true" || sandbox === "1";
		const allKeysPresent =
			merchantId.length > 0 && publicKey.length > 0 && privateKey.length > 0;

		let status: "connected" | "not_configured" | "error" = "not_configured";
		let error: string | undefined;

		if (allKeysPresent) {
			const provider = new BraintreePaymentProvider(
				merchantId,
				publicKey,
				privateKey,
				isSandbox,
			);
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
			ready: status === "connected" && allKeysPresent,
			webhookVerificationConfigured:
				publicKey.length > 0 && privateKey.length > 0,
			error,
			merchantIdMasked: merchantId ? maskKey(merchantId) : null,
			publicKeyMasked: publicKey ? maskKey(publicKey) : null,
			privateKeyMasked: privateKey ? maskKey(privateKey) : null,
			mode: isSandbox ? ("sandbox" as const) : ("production" as const),
		};
	},
);
