"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import AuditLogDetailTemplate from "./audit-log-detail.mdx";

interface AuditEntry {
	id: string;
	action: string;
	resource: string;
	resourceId?: string;
	actorId?: string;
	actorEmail?: string;
	actorType: "admin" | "system" | "api_key";
	description: string;
	changes?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
	createdAt: string;
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(iso));
}

const ACTION_STYLES: Record<string, string> = {
	create:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	update: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	delete: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	bulk_create:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	bulk_update: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	bulk_delete: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	login: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
	logout:
		"bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
	export: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	import: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	settings_change:
		"bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
	status_change: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
	custom: "bg-muted/30 text-foreground/80 ",
};

function ActionBadge({ action }: { action: string }) {
	const style = ACTION_STYLES[action] ?? "bg-muted/30 text-foreground/80 ";
	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${style}`}
		>
			{action.replace(/_/g, " ")}
		</span>
	);
}

function ActorTypeBadge({ type }: { type: string }) {
	const styles: Record<string, string> = {
		admin: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		system: "bg-muted/30 text-foreground/80 ",
		api_key:
			"bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
	};
	const style = styles[type] ?? "bg-muted/30 text-foreground/80 ";
	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${style}`}
		>
			{type.replace(/_/g, " ")}
		</span>
	);
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
	const keys = Object.keys(data);
	if (keys.length === 0) return null;

	return (
		<pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-foreground text-xs leading-relaxed">
			{JSON.stringify(data, null, 2)}
		</pre>
	);
}

export function AuditLogDetail(props: {
	entryId?: string;
	params?: Record<string, string>;
}) {
	const entryId = props.entryId ?? props.params?.id ?? "";
	const client = useModuleClient();
	const api = {
		getEntry: client.module("audit-log").admin["/admin/audit-log/entries/:id"],
	};

	const {
		data: entryData,
		isLoading: loading,
		error: queryError,
	} = api.getEntry.useQuery({ params: { id: entryId } }) as {
		data: { entry: AuditEntry } | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const entry = entryData?.entry ?? null;

	if (loading) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">Loading audit entry...</p>
			</div>
		);
	}

	if (queryError || !entry) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-destructive text-sm" role="alert">
					{queryError
						? "Failed to load audit entry."
						: "Audit entry not found."}
				</p>
			</div>
		);
	}

	const content = (
		<div className="space-y-5 rounded-xl border border-border bg-card p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<ActionBadge action={entry.action} />
						<ActorTypeBadge type={entry.actorType} />
					</div>
					<p className="font-semibold text-foreground text-lg">
						{entry.description}
					</p>
				</div>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatDate(entry.createdAt)}
				</span>
			</div>

			<div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
				<div>
					<p className="font-medium text-muted-foreground text-xs">Resource</p>
					<p className="mt-0.5 text-foreground text-sm">
						{entry.resource}
						{entry.resourceId && (
							<code className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
								{entry.resourceId}
							</code>
						)}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs">Actor</p>
					<p className="mt-0.5 text-foreground text-sm">
						{entry.actorEmail ?? entry.actorId ?? "—"}
					</p>
				</div>
				{entry.ipAddress && (
					<div>
						<p className="font-medium text-muted-foreground text-xs">
							IP Address
						</p>
						<p className="mt-0.5 font-mono text-foreground text-sm">
							{entry.ipAddress}
						</p>
					</div>
				)}
				{entry.userAgent && (
					<div>
						<p className="font-medium text-muted-foreground text-xs">
							User Agent
						</p>
						<p className="mt-0.5 truncate text-foreground text-sm">
							{entry.userAgent}
						</p>
					</div>
				)}
				<div>
					<p className="font-medium text-muted-foreground text-xs">Entry ID</p>
					<p className="mt-0.5">
						<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
							{entry.id}
						</code>
					</p>
				</div>
			</div>

			{entry.changes && Object.keys(entry.changes).length > 0 && (
				<div className="space-y-2">
					<p className="font-medium text-foreground text-sm">Changes</p>
					<JsonBlock data={entry.changes} />
				</div>
			)}

			{entry.metadata && Object.keys(entry.metadata).length > 0 && (
				<div className="space-y-2">
					<p className="font-medium text-foreground text-sm">Metadata</p>
					<JsonBlock data={entry.metadata} />
				</div>
			)}

			<div>
				<a
					href="/admin/audit-log"
					className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Back to Audit Log
				</a>
			</div>
		</div>
	);

	return <AuditLogDetailTemplate content={content} />;
}
