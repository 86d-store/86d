"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AutomationListTemplate from "./automation-list.mdx";

interface AutomationItem {
	id: string;
	name: string;
	description?: string;
	status: "active" | "paused" | "draft";
	triggerEvent: string;
	runCount: number;
	lastRunAt?: string;
}

type StatusFilter = "all" | "active" | "paused" | "draft";

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Active", value: "active" },
	{ label: "Paused", value: "paused" },
	{ label: "Draft", value: "draft" },
];

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
	active:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	paused: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	draft: "bg-muted/30 text-foreground/80 ",
};

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function StatusBadge({ status }: { status: string }) {
	const style = STATUS_STYLES[status] ?? "bg-muted/30 text-foreground/80 ";
	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${style}`}
		>
			{status}
		</span>
	);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function useAutomationsAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("automations").admin["/admin/automations"],
		activate:
			client.module("automations").admin["/admin/automations/:id/activate"],
		pause: client.module("automations").admin["/admin/automations/:id/pause"],
	};
}

export function AutomationList() {
	const api = useAutomationsAdminApi();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [skip, setSkip] = useState(0);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (statusFilter !== "all") queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: automationsError,
		refetch: refetchAutomations,
	} = api.list.useQuery(queryInput) as {
		data: { automations: AutomationItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (automationsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load automations
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAutomations()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const automations = data?.automations ?? [];
	const total = data?.total ?? 0;

	const handleStatusFilterChange = (filter: StatusFilter) => {
		setStatusFilter(filter);
		setSkip(0);
	};

	const hasPrev = skip > 0;
	const hasNext = skip + PAGE_SIZE < total;
	const showingFrom = automations.length > 0 ? skip + 1 : 0;
	const showingTo = Math.min(skip + PAGE_SIZE, total);

	const tableBody =
		loading && automations.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => (
				<tr key={`sk-${i}`}>
					{Array.from({ length: 6 }, (_, j) => (
						<td key={`sk-cell-${j}`} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : automations.length === 0 ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
					No automations found.
				</td>
			</tr>
		) : (
			automations.map((item) => (
				<tr
					key={item.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3">
						<a
							href={`/admin/automations/${item.id}`}
							className="font-medium text-foreground hover:underline"
						>
							{item.name}
						</a>
						{item.description && (
							<p className="mt-0.5 truncate text-muted-foreground text-xs">
								{item.description}
							</p>
						)}
					</td>
					<td className="px-4 py-3">
						<code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{item.triggerEvent}
						</code>
					</td>
					<td className="whitespace-nowrap px-4 py-3">
						<StatusBadge status={item.status} />
					</td>
					<td className="px-4 py-3 text-muted-foreground text-sm">
						{item.runCount}
					</td>
					<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
						{item.lastRunAt ? formatDate(item.lastRunAt) : "Never"}
					</td>
					<td className="px-4 py-3 text-right">
						<a
							href={`/admin/automations/${item.id}`}
							className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
						>
							Edit
						</a>
					</td>
				</tr>
			))
		);

	const statusFilterButtons = STATUS_FILTERS.map((f) => (
		<button
			key={f.value}
			type="button"
			onClick={() => handleStatusFilterChange(f.value)}
			className={`rounded-md px-3 py-1 font-medium text-sm transition-colors ${
				statusFilter === f.value
					? "bg-background text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			}`}
		>
			{f.label}
		</button>
	));

	return (
		<AutomationListTemplate
			total={total}
			statusFilterButtons={statusFilterButtons}
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
