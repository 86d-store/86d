"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import NotificationTemplateListTemplate from "./notification-template-list.mdx";

interface TemplateItem {
	id: string;
	slug: string;
	name: string;
	type: string;
	channel: string;
	priority: string;
	titleTemplate: string;
	bodyTemplate: string;
	variables: string[];
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
	info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	success:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	warning:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	order:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	shipping: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
	promotion:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

function useTemplatesApi() {
	const client = useModuleClient();
	return {
		list: client.module("notifications").admin[
			"/admin/notifications/templates"
		],
		create:
			client.module("notifications").admin[
				"/admin/notifications/templates/create"
			],
		update:
			client.module("notifications").admin[
				"/admin/notifications/templates/:id/update"
			],
		deleteTemplate:
			client.module("notifications").admin[
				"/admin/notifications/templates/:id/delete"
			],
	};
}

function DeleteTemplateModal({
	template,
	onClose,
	onSuccess,
}: {
	template: TemplateItem;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useTemplatesApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.deleteTemplate.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSuccess();
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">
						Delete template?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						&ldquo;
						<span className="font-medium text-foreground">{template.name}</span>
						&rdquo; will be permanently deleted.
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<button
							ref={cancelRef}
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() =>
								deleteMutation.mutate({
									params: { id: template.id },
								})
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function NotificationTemplateList() {
	const api = useTemplatesApi();
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null);
	const pageSize = 25;

	useEffect(() => {
		if (!deleteTarget) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setDeleteTarget(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [deleteTarget]);

	const {
		data,
		isLoading: loading,
		isError: templatesError,
		refetch: refetchTemplates,
	} = api.list.useQuery({
		page: String(page),
		limit: String(pageSize),
	}) as {
		data: { templates: TemplateItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (templatesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load notification templates
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchTemplates()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const templates = data?.templates ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 6 }).map((_, j) => (
					<td key={`skeleton-cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : templates.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No templates found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create a template to send reusable notifications
				</p>
			</td>
		</tr>
	) : (
		templates.map((t) => (
			<tr key={t.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<div>
						<span className="font-medium text-foreground text-sm">
							{t.name}
						</span>
						<p className="mt-0.5 font-mono text-muted-foreground text-xs">
							{t.slug}
						</p>
					</div>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${TYPE_COLORS[t.type] ?? "bg-muted text-muted-foreground"}`}
					>
						{t.type}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
					{t.priority}
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{t.active ? (
						<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
							Active
						</span>
					) : (
						<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
							Inactive
						</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-xs lg:table-cell">
					{t.variables.length > 0 ? t.variables.join(", ") : "\u2014"}
				</td>
				<td className="px-4 py-3 text-right">
					<button
						type="button"
						onClick={() => setDeleteTarget(t)}
						className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Delete
					</button>
				</td>
			</tr>
		))
	);

	return (
		<NotificationTemplateListTemplate
			subtitle={`${total} template${total !== 1 ? "s" : ""}`}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			deleteModal={
				deleteTarget ? (
					<DeleteTemplateModal
						template={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={() => setDeleteTarget(null)}
					/>
				) : null
			}
		/>
	);
}
