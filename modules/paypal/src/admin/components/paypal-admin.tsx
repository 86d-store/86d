"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import PayPalAdminTemplate from "./paypal-admin.mdx";

interface PayPalSettings {
	status: "connected" | "not_configured" | "error";
	error?: string;
	clientIdMasked: string | null;
	clientSecretMasked: string | null;
	mode: "sandbox" | "live";
	webhookIdConfigured: boolean;
	webhookIdMasked: string | null;
}

function usePayPalAdminApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("paypal").admin["/admin/paypal/settings"],
	};
}

const MODE_COLORS: Record<string, string> = {
	live: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	sandbox:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const STATUS_CONFIG: Record<
	PayPalSettings["status"],
	{ label: string; badge: string; badgeClass: string }
> = {
	connected: {
		label: "Connected",
		badge: "active",
		badgeClass:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	},
	not_configured: {
		label: "Not configured",
		badge: "inactive",
		badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	},
	error: {
		label: "Error",
		badge: "error",
		badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	},
};

function SettingsCard({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-5">
			<h3 className="mb-3 font-semibold text-foreground text-sm">{label}</h3>
			{children}
		</div>
	);
}

function StatusRow({
	label,
	value,
	mono,
	badge,
	badgeClass,
}: {
	label: string;
	value: string;
	mono?: boolean;
	badge?: string;
	badgeClass?: string;
}) {
	return (
		<div className="flex items-center justify-between py-2">
			<span className="text-muted-foreground text-sm">{label}</span>
			<div className="flex items-center gap-2">
				{badge && (
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badgeClass ?? "bg-muted text-muted-foreground"}`}
					>
						{badge}
					</span>
				)}
				<span
					className={`text-foreground text-sm ${mono ? "font-mono text-xs" : ""}`}
				>
					{value}
				</span>
			</div>
		</div>
	);
}

export function PayPalAdmin() {
	const api = usePayPalAdminApi();
	const { data, isLoading } = api.getSettings.useQuery({}) as {
		data: PayPalSettings | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<PayPalAdminTemplate
				content={
					<div className="space-y-4">
						{Array.from({ length: 2 }).map((_, i) => (
							<div
								key={`skeleton-${i}`}
								className="h-40 animate-pulse rounded-lg border border-border bg-muted/30"
							/>
						))}
					</div>
				}
			/>
		);
	}

	const settings = data;
	const statusInfo = STATUS_CONFIG[settings?.status ?? "not_configured"];

	return (
		<PayPalAdminTemplate
			content={
				<div className="space-y-4">
					<SettingsCard label="Connection">
						<div className="divide-y divide-border">
							<StatusRow
								label="Status"
								value={statusInfo.label}
								badge={statusInfo.badge}
								badgeClass={statusInfo.badgeClass}
							/>
							<StatusRow
								label="Environment"
								value={settings?.mode ?? "live"}
								badge={settings?.mode ?? "live"}
								badgeClass={MODE_COLORS[settings?.mode ?? "live"]}
							/>
							{settings?.clientIdMasked && (
								<StatusRow
									label="Client ID"
									value={settings.clientIdMasked}
									mono
								/>
							)}
							{settings?.clientSecretMasked && (
								<StatusRow
									label="Client secret"
									value={settings.clientSecretMasked}
									mono
								/>
							)}
						</div>

						{settings?.status === "not_configured" && (
							<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
								Add your PayPal client ID and secret to the module configuration
								to enable payment processing.
							</div>
						)}

						{settings?.status === "error" && (
							<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
								{settings.error ??
									"Could not connect to PayPal. Check your credentials."}
							</div>
						)}
					</SettingsCard>

					<SettingsCard label="Webhooks">
						<div className="divide-y divide-border">
							<StatusRow
								label="Webhook verification"
								value={settings?.webhookIdConfigured ? "Enabled" : "Disabled"}
								badge={settings?.webhookIdConfigured ? "secure" : "unverified"}
								badgeClass={
									settings?.webhookIdConfigured
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
								}
							/>
							{settings?.webhookIdMasked && (
								<StatusRow
									label="Webhook ID"
									value={settings.webhookIdMasked}
									mono
								/>
							)}
							<StatusRow
								label="Endpoint path"
								value="/api/store/paypal/webhook"
								mono
							/>
						</div>
					</SettingsCard>

					<SettingsCard label="Supported Events">
						<div className="flex flex-wrap gap-2">
							{[
								"PAYMENT.CAPTURE.COMPLETED",
								"PAYMENT.CAPTURE.DENIED",
								"PAYMENT.CAPTURE.PENDING",
								"PAYMENT.CAPTURE.REFUNDED",
								"PAYMENT.SALE.REFUNDED",
							].map((event) => (
								<span
									key={event}
									className="rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground text-xs"
								>
									{event}
								</span>
							))}
						</div>
					</SettingsCard>
				</div>
			}
		/>
	);
}
