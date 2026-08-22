"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import BraintreeAdminTemplate from "./braintree-admin.mdx";

interface BraintreeSettings {
	status: "connected" | "not_configured" | "error";
	error?: string;
	merchantIdMasked: string | null;
	publicKeyMasked: string | null;
	privateKeyMasked: string | null;
	mode: "sandbox" | "production";
}

function useBraintreeAdminApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("braintree").admin["/admin/braintree/settings"],
	};
}

const MODE_COLORS: Record<string, string> = {
	production:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	sandbox:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const STATUS_CONFIG: Record<
	BraintreeSettings["status"],
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

export function BraintreeAdmin() {
	const api = useBraintreeAdminApi();
	const { data, isLoading } = api.getSettings.useQuery({}) as {
		data: BraintreeSettings | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<BraintreeAdminTemplate
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
		<BraintreeAdminTemplate
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
								value={settings?.mode ?? "production"}
								badge={settings?.mode ?? "production"}
								badgeClass={MODE_COLORS[settings?.mode ?? "production"]}
							/>
							{settings?.merchantIdMasked && (
								<StatusRow
									label="Merchant ID"
									value={settings.merchantIdMasked}
									mono
								/>
							)}
							{settings?.publicKeyMasked && (
								<StatusRow
									label="Public key"
									value={settings.publicKeyMasked}
									mono
								/>
							)}
							{settings?.privateKeyMasked && (
								<StatusRow
									label="Private key"
									value={settings.privateKeyMasked}
									mono
								/>
							)}
						</div>

						{settings?.status === "not_configured" && (
							<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
								Add your Braintree merchant ID, public key, and private key to
								the module configuration to enable payment processing.
							</div>
						)}

						{settings?.status === "error" && (
							<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
								{settings.error ??
									"Could not connect to Braintree. Check your credentials."}
							</div>
						)}
					</SettingsCard>

					<SettingsCard label="Webhooks">
						<div className="divide-y divide-border">
							<StatusRow
								label="Endpoint path"
								value="/api/store/braintree/webhook"
								mono
							/>
						</div>
					</SettingsCard>

					<SettingsCard label="Supported Events">
						<div className="flex flex-wrap gap-2">
							{[
								"transaction_settled",
								"transaction_disbursed",
								"transaction_settlement_declined",
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
