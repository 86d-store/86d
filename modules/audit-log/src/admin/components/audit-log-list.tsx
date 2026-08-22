"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AuditLogListTemplate from "./audit-log-list.mdx";

interface AuditEntry {
	id: string;
	action: string;
	resource: string;
	resourceId?: string;
	actorId?: string;
	actorEmail?: string;
	actorType: "admin" | "system" | "api_key";
	description: string;
	ipAddress?: string;
	createdAt: string;
}

type ActionFilter =
	| "all"
	| "create"
	| "update"
	| "delete"
	| "login"
	| "logout"
	| "settings_change"
	| "status_change";

type ActorTypeFilter = "all" | "admin" | "system" | "api_key";

const ACTION_FILTERS: { label: string; value: ActionFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Create", value: "create" },
	{ label: "Update", value: "update" },
	{ label: "Delete", value: "delete" },
	{ label: "Login", value: "login" },
	{ label: "Logout", value: "logout" },
	{ label: "Settings", value: "settings_change" },
	{ label: "Status", value: "status_change" },
];

const ACTOR_TYPE_FILTERS: { label: string; value: ActorTypeFilter }[] = [
	{ label: "All Actors", value: "all" },
	{ label: "Admin", value: "admin" },
	{ label: "System", value: "system" },
	{ label: "API Key", value: "api_key" },
];

const PAGE_SIZE = 25;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
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

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

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

function useAuditLogAdminApi() {
	const client = useModuleClient();
	return {
		listEntries: client.module("audit-log").admin["/admin/audit-log/entries"],
		getEntry: client.module("audit-log").admin["/admin/audit-log/entries/:id"],
		summary: client.module("audit-log").admin["/admin/audit-log/summary"],
		purge: client.module("audit-log").admin["/admin/audit-log/purge"],
	};
}

export function AuditLogList() {
	const api = useAuditLogAdminApi();
	const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
	const [actorTypeFilter, setActorTypeFilter] =
		useState<ActorTypeFilter>("all");
	const [skip, setSkip] = useState(0);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (actionFilter !== "all") queryInput.action = actionFilter;
	if (actorTypeFilter !== "all") queryInput.actorType = actorTypeFilter;

	const {
		data,
		isLoading: loading,
		isError: entriesError,
		refetch: refetchEntries,
	} = api.listEntries.useQuery(queryInput) as {
		data: { entries: AuditEntry[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (entriesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load audit log
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchEntries()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const entries = data?.entries ?? [];
	const total = data?.total ?? 0;

	const handleActionFilterChange = (filter: ActionFilter) => {
		setActionFilter(filter);
		setSkip(0);
	};

	const handleActorTypeFilterChange = (filter: ActorTypeFilter) => {
		setActorTypeFilter(filter);
		setSkip(0);
	};

	const hasPrev = skip > 0;
	const hasNext = skip + PAGE_SIZE < total;
	const showingFrom = entries.length > 0 ? skip + 1 : 0;
	const showingTo = Math.min(skip + PAGE_SIZE, total);

	const tableBody =
		loading && entries.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => `skel-row-${i}`).map((key) => (
				<tr key={key}>
					{Array.from({ length: 6 }, (_, i) => `skel-cell-${i}`).map((key) => (
						<td key={key} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : entries.length === 0 ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
					No audit entries found.
				</td>
			</tr>
		) : (
			entries.map((entry) => (
				<tr
					key={entry.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="whitespace-nowrap px-4 py-3">
						<ActionBadge action={entry.action} />
					</td>
					<td className="px-4 py-3 text-foreground">
						{entry.resource}
						{entry.resourceId && (
							<code className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
								{entry.resourceId}
							</code>
						)}
					</td>
					<td className="max-w-xs px-4 py-3">
						<p className="truncate text-foreground text-sm">
							{entry.description}
						</p>
					</td>
					<td className="whitespace-nowrap px-4 py-3">
						<ActorTypeBadge type={entry.actorType} />
						{entry.actorEmail && (
							<span className="ml-1.5 text-muted-foreground text-xs">
								{entry.actorEmail}
							</span>
						)}
					</td>
					<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
						{formatDate(entry.createdAt)}
					</td>
					<td className="px-4 py-3 text-right">
						<a
							href={`/admin/audit-log/${entry.id}`}
							className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
						>
							Details
						</a>
					</td>
				</tr>
			))
		);

	const actionFilterButtons = ACTION_FILTERS.map((f) => (
		<button
			key={f.value}
			type="button"
			onClick={() => handleActionFilterChange(f.value)}
			className={`rounded-md px-3 py-1 font-medium text-sm transition-colors ${
				actionFilter === f.value
					? "bg-background text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			}`}
		>
			{f.label}
		</button>
	));

	const actorTypeFilterButtons = ACTOR_TYPE_FILTERS.map((f) => (
		<button
			key={f.value}
			type="button"
			onClick={() => handleActorTypeFilterChange(f.value)}
			className={`rounded-md px-3 py-1 font-medium text-sm transition-colors ${
				actorTypeFilter === f.value
					? "bg-background text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			}`}
		>
			{f.label}
		</button>
	));

	return (
		<AuditLogListTemplate
			total={total}
			actionFilterButtons={actionFilterButtons}
			actorTypeFilterButtons={actorTypeFilterButtons}
			tableBody={tableBody}
			showingFrom={showingFrom}
			showingTo={showingTo}
			hasPrev={hasPrev}
			hasNext={hasNext}
			loading={loading}
			onPrevPage={() => setSkip((s: number) => Math.max(0, s - PAGE_SIZE))}
			onNextPage={() => setSkip((s: number) => s + PAGE_SIZE)}
		/>
	);
}
