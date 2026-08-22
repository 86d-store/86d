"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import AutomationDetailTemplate from "./automation-detail.mdx";

interface AutomationData {
	id: string;
	name: string;
	description?: string;
	status: "active" | "paused" | "draft";
	triggerEvent: string;
	conditions: Array<{
		field: string;
		operator: string;
		value?: unknown;
	}>;
	actions: Array<{ type: string; config: Record<string, unknown> }>;
	priority: number;
	runCount: number;
	lastRunAt?: string;
}

interface ExecutionData {
	id: string;
	status: string;
	startedAt: string;
	completedAt?: string;
	error?: string;
}

const STATUS_STYLES: Record<string, string> = {
	active:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	paused: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	draft: "bg-muted/30 text-foreground/80 ",
};

const EXEC_STATUS_STYLES: Record<string, string> = {
	completed:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
	skipped: "bg-muted/30 text-foreground/80 ",
	running: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

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
		get: client.module("automations").admin["/admin/automations/:id"],
		executions:
			client.module("automations").admin["/admin/automations/executions"],
	};
}

export function AutomationDetail({ id }: { id: string }) {
	const api = useAutomationsAdminApi();

	const { data: automationData, isLoading: loading } = api.get.useQuery({
		id,
	}) as {
		data: { automation: AutomationData } | undefined;
		isLoading: boolean;
	};

	const { data: execData } = api.executions.useQuery({
		automationId: id,
		take: "10",
	}) as {
		data: { executions: ExecutionData[]; total: number } | undefined;
	};

	const automation = automationData?.automation;
	const executions = execData?.executions ?? [];

	const statusBadge = automation ? (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
				STATUS_STYLES[automation.status] ?? ""
			}`}
		>
			{automation.status}
		</span>
	) : null;

	const actionButtons = automation ? (
		<>
			{automation.status !== "active" && (
				<a
					href={`/admin/automations/${id}/activate`}
					className="rounded-md border border-border px-3 py-1.5 font-medium text-sm hover:bg-muted"
				>
					Activate
				</a>
			)}
			{automation.status === "active" && (
				<a
					href={`/admin/automations/${id}/pause`}
					className="rounded-md border border-border px-3 py-1.5 font-medium text-sm hover:bg-muted"
				>
					Pause
				</a>
			)}
		</>
	) : null;

	const actionsDisplay = automation ? (
		<div className="space-y-2">
			{automation.actions.map((action, i) => (
				<div
					key={action.id}
					className="flex items-center gap-3 rounded-md border border-border p-3"
				>
					<span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
						{i + 1}
					</span>
					<span className="font-medium text-foreground text-sm">
						{action.type.replace(/_/g, " ")}
					</span>
					<code className="text-muted-foreground text-xs">
						{JSON.stringify(action.config)}
					</code>
				</div>
			))}
		</div>
	) : null;

	const conditionsDisplay =
		automation && automation.conditions.length > 0 ? (
			<div className="space-y-2">
				{automation.conditions.map((cond, _i) => (
					<div
						key={cond.id}
						className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
					>
						<code className="font-medium">{cond.field}</code>
						<span className="text-muted-foreground">{cond.operator}</span>
						{cond.value !== undefined && (
							<code className="text-muted-foreground">
								{String(cond.value)}
							</code>
						)}
					</div>
				))}
			</div>
		) : null;

	const executionsTable =
		executions.length === 0 ? (
			<p className="text-muted-foreground text-sm">No executions yet.</p>
		) : (
			<table className="w-full text-left text-sm">
				<thead>
					<tr className="border-border border-b">
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Status
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Started
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Error
						</th>
					</tr>
				</thead>
				<tbody>
					{executions.map((exec) => (
						<tr key={exec.id} className="border-border border-b last:border-0">
							<td className="px-4 py-2">
								<span
									className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
										EXEC_STATUS_STYLES[exec.status] ?? ""
									}`}
								>
									{exec.status}
								</span>
							</td>
							<td className="px-4 py-2 text-muted-foreground">
								{formatDate(exec.startedAt)}
							</td>
							<td className="px-4 py-2 text-muted-foreground text-xs">
								{exec.error ?? "-"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		);

	return (
		<AutomationDetailTemplate
			loading={loading}
			notFound={!loading && !automation}
			name={automation?.name}
			description={automation?.description}
			triggerEvent={automation?.triggerEvent}
			priority={automation?.priority}
			runCount={automation?.runCount}
			statusBadge={statusBadge}
			actionButtons={actionButtons}
			actionCount={automation?.actions.length ?? 0}
			actionsDisplay={actionsDisplay}
			conditionCount={automation?.conditions.length ?? 0}
			conditionsDisplay={conditionsDisplay}
			executionsTable={executionsTable}
		/>
	);
}
