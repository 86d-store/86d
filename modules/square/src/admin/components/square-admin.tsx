"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import SquareAdminTemplate from "./square-admin.mdx";

interface SquareSettings {
	status: "connected" | "not_configured" | "error";
	error?: string;
	locationCount?: number;
	accessTokenMasked: string | null;
	webhookSignatureConfigured: boolean;
	webhookSignatureKeyMasked: string | null;
	webhookNotificationUrl: string | null;
}

function useSquareAdminApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("square").admin["/admin/square/settings"],
	};
}

const STATUS_CONFIG: Record<
	SquareSettings["status"],
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

export function SquareAdmin() {
	const api = useSquareAdminApi();
	const { data, isLoading } = api.getSettings.useQuery({}) as {
		data: SquareSettings | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<SquareAdminTemplate
				content={
					<div className="space-y-4">
						{(["k0", "k1"] as const).map((key) => (
							<div
								key={key}
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
		<SquareAdminTemplate
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
							{settings?.status === "connected" &&
								settings.locationCount !== undefined && (
									<StatusRow
										label="Locations"
										value={String(settings.locationCount)}
									/>
								)}
							{settings?.accessTokenMasked && (
								<StatusRow
									label="Access token"
									value={settings.accessTokenMasked}
									mono
								/>
							)}
						</div>

						{settings?.status === "not_configured" && (
							<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
								Add your Square access token to the module configuration to
								enable payment processing.
							</div>
						)}

						{settings?.status === "error" && (
							<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
								{settings.error ??
									"Could not connect to Square. Check your access token."}
							</div>
						)}
					</SettingsCard>

					<SettingsCard label="Webhooks">
						<div className="divide-y divide-border">
							<StatusRow
								label="Signature verification"
								value={
									settings?.webhookSignatureConfigured ? "Enabled" : "Disabled"
								}
								badge={
									settings?.webhookSignatureConfigured ? "secure" : "unverified"
								}
								badgeClass={
									settings?.webhookSignatureConfigured
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
								}
							/>
							{settings?.webhookSignatureKeyMasked && (
								<StatusRow
									label="Signature key"
									value={settings.webhookSignatureKeyMasked}
									mono
								/>
							)}
							{settings?.webhookNotificationUrl && (
								<StatusRow
									label="Notification URL"
									value={settings.webhookNotificationUrl}
									mono
								/>
							)}
							<StatusRow
								label="Endpoint path"
								value="/api/store/square/webhook"
								mono
							/>
						</div>
					</SettingsCard>

					<SettingsCard label="Supported Events">
						<div className="flex flex-wrap gap-2">
							{[
								"payment.completed",
								"payment.failed",
								"payment.canceled",
								"refund.completed",
								"refund.updated",
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
