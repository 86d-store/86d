"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import AnalyticsSettingsTemplate from "./analytics-settings.mdx";

type ConnectionStatus = "connected" | "not_configured" | "error";

interface GtmStatus {
	configured: boolean;
	provider: string;
	containerId: string | null;
}

interface Ga4Status {
	status: ConnectionStatus;
	error?: string;
	configured: boolean;
	provider: string;
	measurementId: string | null;
}

interface SentryStatus {
	status: ConnectionStatus;
	error?: string;
	configured: boolean;
	provider: string;
	dsn: string | null;
	host: string | null;
}

interface SettingsData {
	gtm: GtmStatus;
	ga4: Ga4Status;
	sentry: SentryStatus;
}

function useAnalyticsSettingsApi() {
	const client = useModuleClient();
	return {
		settings: client.module("analytics").admin["/admin/analytics/settings"],
	};
}

export function AnalyticsSettings() {
	const api = useAnalyticsSettingsApi();
	const { data, isLoading, error } = api.settings.useQuery({}) as {
		data: SettingsData | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	return (
		<AnalyticsSettingsTemplate
			data={data ?? null}
			isLoading={isLoading}
			error={error?.message ?? null}
		/>
	);
}
