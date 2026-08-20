import { createAdminEndpoint } from "@86d-app/core/api";
import { GA4Provider } from "../../providers/ga4";
import { SentryProvider } from "../../providers/sentry";

type ConnectionStatus = "connected" | "not_configured" | "error";

interface SettingsOptions {
	gtmContainerId?: string | undefined;
	sentryDsn?: string | undefined;
	ga4MeasurementId?: string | undefined;
	ga4ApiSecret?: string | undefined;
}

export function createGetSettingsEndpoint(options: SettingsOptions) {
	return createAdminEndpoint(
		"/admin/analytics/settings",
		{ method: "GET" },
		async () => {
			const gtmConfigured = Boolean(options.gtmContainerId);

			const sentryDsn = options.sentryDsn ?? "";
			let sentryStatus: ConnectionStatus = "not_configured";
			let sentryError: string | undefined;
			let sentryHost: string | null = null;
			if (sentryDsn.length > 0) {
				const build = SentryProvider.fromDsn(sentryDsn);
				if (!build.ok) {
					sentryStatus = "error";
					sentryError = build.error;
				} else {
					sentryHost = build.provider.getParsedDsn().host;
					const verify = await build.provider.verifyConnection();
					if (verify.ok) {
						sentryStatus = "connected";
					} else {
						sentryStatus = "error";
						sentryError = verify.error;
					}
				}
			}

			const ga4Configured = Boolean(
				options.ga4MeasurementId && options.ga4ApiSecret,
			);
			let ga4Status: ConnectionStatus = "not_configured";
			let ga4Error: string | undefined;
			if (ga4Configured && options.ga4MeasurementId && options.ga4ApiSecret) {
				const provider = new GA4Provider(
					options.ga4MeasurementId,
					options.ga4ApiSecret,
				);
				const result = await provider.verifyConnection();
				if (result.ok) {
					ga4Status = "connected";
				} else {
					ga4Status = "error";
					ga4Error = result.error;
				}
			}

			return {
				gtm: {
					configured: gtmConfigured,
					provider: "google-tag-manager",
					containerId: options.gtmContainerId ?? null,
				},
				ga4: {
					status: ga4Status,
					error: ga4Error,
					configured: ga4Configured,
					provider: "ga4-measurement-protocol",
					measurementId: options.ga4MeasurementId ?? null,
				},
				sentry: {
					status: sentryStatus,
					error: sentryError,
					configured: sentryStatus === "connected",
					provider: "sentry",
					dsn: sentryDsn ? `${sentryDsn.slice(0, 20)}...` : null,
					host: sentryHost,
				},
			};
		},
	);
}
