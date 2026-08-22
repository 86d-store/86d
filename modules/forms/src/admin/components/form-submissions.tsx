"use client";

import { useState } from "react";
import { type Form, formatDate, useFormsApi } from "./_shared";

interface FormSubmission {
	id: string;
	formId: string;
	values: Record<string, unknown>;
	ipAddress?: string;
	status: string;
	createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
	unread: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	read: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	spam: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	archived: "bg-muted text-muted-foreground",
};

export function FormSubmissions({
	params,
}: {
	params?: Record<string, string>;
}) {
	const formId = params?.id ?? "";
	const api = useFormsApi();

	const [statusFilter, setStatusFilter] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const { data: formData, isLoading: formLoading } = api.detail.useQuery({
		id: formId,
	}) as {
		data: { form?: Form } | undefined;
		isLoading: boolean;
	};

	const { data: subData, isLoading: subLoading } = api.submissions.useQuery({
		formId,
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { submissions?: FormSubmission[] } | undefined;
		isLoading: boolean;
	};

	const updateStatusMutation = api.updateStatus.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: { status: string };
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const bulkDeleteMutation = api.bulkDelete.useMutation() as {
		mutateAsync: (opts: { body: { ids: string[] } }) => Promise<unknown>;
		isPending: boolean;
	};

	const form = formData?.form;
	const submissions = subData?.submissions ?? [];
	const isLoading = formLoading || subLoading;

	const toggleSelect = (subId: string) => {
		setSelected((prev: Set<string>) => {
			const next = new Set(prev);
			if (next.has(subId)) {
				next.delete(subId);
			} else {
				next.add(subId);
			}
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (selected.size === submissions.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(submissions.map((s) => s.id)));
		}
	};

	const handleStatusChange = async (subId: string, status: string) => {
		try {
			await updateStatusMutation.mutateAsync({
				params: { id: subId },
				body: { status },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleBulkDelete = async () => {
		if (selected.size === 0) return;
		if (!confirm(`Delete ${selected.size} submission(s)?`)) return;
		try {
			await bulkDeleteMutation.mutateAsync({
				body: { ids: Array.from(selected) },
			});
			setSelected(new Set());
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/forms"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to forms
					</a>
				</div>
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href={form ? `/admin/forms/${form.id}` : "/admin/forms"}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to {form?.name ?? "forms"}
				</a>
			</div>

			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Submissions{form ? `: ${form.name}` : ""}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{submissions.length} submission
						{submissions.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="flex gap-2">
					<select
						aria-label="Filter by status"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
					>
						<option value="">All statuses</option>
						<option value="unread">Unread</option>
						<option value="read">Read</option>
						<option value="spam">Spam</option>
						<option value="archived">Archived</option>
					</select>
					{selected.size > 0 ? (
						<button
							type="button"
							onClick={handleBulkDelete}
							disabled={bulkDeleteMutation.isPending}
							className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
						>
							Delete ({selected.size})
						</button>
					) : null}
				</div>
			</div>

			{submissions.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No submissions{statusFilter ? ` with status "${statusFilter}"` : ""}{" "}
						yet.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{/* Select all */}
					<div className="flex items-center gap-2 px-1">
						<input
							type="checkbox"
							checked={
								selected.size === submissions.length && submissions.length > 0
							}
							onChange={toggleSelectAll}
							className="rounded"
						/>
						<span className="text-muted-foreground text-xs">Select all</span>
					</div>

					{submissions.map((sub) => (
						<div
							key={sub.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="mb-2 flex items-start justify-between gap-3">
								<div className="flex items-start gap-3">
									<input
										type="checkbox"
										checked={selected.has(sub.id)}
										onChange={() => toggleSelect(sub.id)}
										className="mt-1 rounded"
									/>
									<div>
										<div className="flex items-center gap-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[sub.status] ?? "bg-muted text-muted-foreground"}`}
											>
												{sub.status}
											</span>
											<span className="text-muted-foreground text-xs">
												{formatDate(sub.createdAt)}
											</span>
											{sub.ipAddress ? (
												<span className="text-muted-foreground text-xs">
													{sub.ipAddress}
												</span>
											) : null}
										</div>
									</div>
								</div>
								<div className="flex gap-1">
									{sub.status === "unread" ? (
										<button
											type="button"
											onClick={() => handleStatusChange(sub.id, "read")}
											className="rounded px-2 py-1 text-xs hover:bg-muted"
										>
											Mark Read
										</button>
									) : sub.status === "read" ? (
										<button
											type="button"
											onClick={() => handleStatusChange(sub.id, "archived")}
											className="rounded px-2 py-1 text-xs hover:bg-muted"
										>
											Archive
										</button>
									) : null}
									{sub.status !== "spam" ? (
										<button
											type="button"
											onClick={() => handleStatusChange(sub.id, "spam")}
											className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											Spam
										</button>
									) : (
										<button
											type="button"
											onClick={() => handleStatusChange(sub.id, "unread")}
											className="rounded px-2 py-1 text-xs hover:bg-muted"
										>
											Not Spam
										</button>
									)}
								</div>
							</div>

							{/* Submitted values */}
							<div className="mt-2 rounded-md bg-muted/30 p-3">
								<dl className="grid gap-1 text-sm sm:grid-cols-2">
									{Object.entries(sub.values).map(([key, val]) => (
										<div key={key}>
											<dt className="font-medium text-muted-foreground text-xs">
												{key}
											</dt>
											<dd className="text-foreground">
												{val === null || val === undefined ? "—" : String(val)}
											</dd>
										</div>
									))}
								</dl>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
