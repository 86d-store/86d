"use client";

import { useState } from "react";
import {
	extractError,
	FieldBuilder,
	type Form,
	type FormField,
	formatDate,
	useFormsApi,
} from "./_shared";

export function FormDetail({ params }: { params?: Record<string, string> }) {
	const id = params?.id ?? "";
	const api = useFormsApi();

	const { data, isLoading } = api.detail.useQuery({ id }) as {
		data: { form?: Form } | undefined;
		isLoading: boolean;
	};

	const updateMutation = api.update.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<{ form?: Form }>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteForm.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const form = data?.form;

	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editSlug, setEditSlug] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editSubmitLabel, setEditSubmitLabel] = useState("");
	const [editSuccessMessage, setEditSuccessMessage] = useState("");
	const [editNotifyEmail, setEditNotifyEmail] = useState("");
	const [editHoneypotEnabled, setEditHoneypotEnabled] = useState(true);
	const [editMaxSubmissions, setEditMaxSubmissions] = useState(0);
	const [editFields, setEditFields] = useState<FormField[]>([]);
	const [error, setError] = useState("");

	const startEditing = () => {
		if (!form) return;
		setEditName(form.name);
		setEditSlug(form.slug);
		setEditDescription(form.description ?? "");
		setEditSubmitLabel(form.submitLabel);
		setEditSuccessMessage(form.successMessage);
		setEditNotifyEmail(form.notifyEmail ?? "");
		setEditHoneypotEnabled(form.honeypotEnabled);
		setEditMaxSubmissions(form.maxSubmissions);
		setEditFields(form.fields);
		setEditing(true);
		setError("");
	};

	const handleSave = async () => {
		setError("");
		try {
			await updateMutation.mutateAsync({
				params: { id },
				body: {
					name: editName.trim(),
					slug: editSlug.trim(),
					description: editDescription.trim() || undefined,
					fields: editFields,
					submitLabel: editSubmitLabel.trim(),
					successMessage: editSuccessMessage.trim(),
					notifyEmail: editNotifyEmail.trim() || undefined,
					honeypotEnabled: editHoneypotEnabled,
					maxSubmissions: editMaxSubmissions,
				},
			});
			setEditing(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleToggleActive = async () => {
		if (!form) return;
		try {
			await updateMutation.mutateAsync({
				params: { id },
				body: { isActive: !form.isActive },
			});
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async () => {
		if (!confirm("Delete this form and all its submissions?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.href = "/admin/forms";
		} catch (err) {
			setError(extractError(err));
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
				<div className="space-y-4">
					<div className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
					<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
				</div>
			</div>
		);
	}

	if (!form) {
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
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Form not found.</p>
				</div>
			</div>
		);
	}

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

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main content */}
				<div className="space-y-6 lg:col-span-2">
					{/* Header */}
					<div className="rounded-lg border border-border bg-card p-5">
						<div className="mb-3 flex items-start justify-between gap-3">
							<div>
								<h1 className="font-bold text-foreground text-lg">
									{form.name}
								</h1>
								{form.description ? (
									<p className="mt-1 text-muted-foreground text-sm">
										{form.description}
									</p>
								) : null}
							</div>
							<span
								className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium text-xs ${
									form.isActive
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{form.isActive ? "Active" : "Inactive"}
							</span>
						</div>
						<div className="flex flex-wrap gap-2 border-border border-t pt-3">
							{!editing ? (
								<>
									<button
										type="button"
										onClick={startEditing}
										className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
									>
										Edit
									</button>
									<button
										type="button"
										onClick={handleToggleActive}
										className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-sm hover:bg-muted"
									>
										{form.isActive ? "Deactivate" : "Activate"}
									</button>
									<a
										href={`/admin/forms/${form.id}/submissions`}
										className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
									>
										View Submissions
									</a>
									<button
										type="button"
										onClick={handleDelete}
										disabled={deleteMutation.isPending}
										className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										Delete
									</button>
								</>
							) : (
								<>
									<button
										type="button"
										onClick={handleSave}
										disabled={updateMutation.isPending}
										className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
									>
										{updateMutation.isPending ? "Saving..." : "Save Changes"}
									</button>
									<button
										type="button"
										onClick={() => setEditing(false)}
										className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
									>
										Cancel
									</button>
								</>
							)}
						</div>
					</div>

					{/* Fields section */}
					<div className="rounded-lg border border-border bg-card">
						<div className="border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Fields ({editing ? editFields.length : form.fields.length})
							</h2>
						</div>

						{editing ? (
							<div className="p-4">
								<FieldBuilder fields={editFields} onChange={setEditFields} />
							</div>
						) : form.fields.length === 0 ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								No fields defined. Edit this form to add fields.
							</div>
						) : (
							<div className="divide-y divide-border">
								{form.fields
									.sort((a, b) => a.position - b.position)
									.map((field) => (
										<div
											key={field.name}
											className="flex items-center justify-between px-4 py-3"
										>
											<div>
												<p className="font-medium text-foreground text-sm">
													{field.label}
												</p>
												<p className="text-muted-foreground text-xs">
													{field.type}
													{field.required ? " · required" : ""}
													{field.placeholder ? ` · "${field.placeholder}"` : ""}
													{field.options
														? ` · options: ${field.options.join(", ")}`
														: ""}
												</p>
											</div>
											<span className="font-mono text-muted-foreground text-xs">
												{field.name}
											</span>
										</div>
									))}
							</div>
						)}
					</div>

					{/* Edit settings section */}
					{editing ? (
						<div className="rounded-lg border border-border bg-card p-5">
							<h2 className="mb-4 font-semibold text-foreground text-sm">
								Settings
							</h2>
							<div className="grid gap-4 sm:grid-cols-2">
								<label className="block">
									<span className="mb-1 block font-medium text-sm">Name</span>
									<input
										type="text"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block font-medium text-sm">Slug</span>
									<input
										type="text"
										value={editSlug}
										onChange={(e) => setEditSlug(e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block font-medium text-sm">
										Submit Button Label
									</span>
									<input
										type="text"
										value={editSubmitLabel}
										onChange={(e) => setEditSubmitLabel(e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block font-medium text-sm">
										Notification Email
									</span>
									<input
										type="email"
										value={editNotifyEmail}
										onChange={(e) => setEditNotifyEmail(e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
							</div>
							<div className="mt-4">
								<label className="block">
									<span className="mb-1 block font-medium text-sm">
										Description
									</span>
									<input
										type="text"
										value={editDescription}
										onChange={(e) => setEditDescription(e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
							</div>
							<div className="mt-4">
								<label className="block">
									<span className="mb-1 block font-medium text-sm">
										Success Message
									</span>
									<textarea
										value={editSuccessMessage}
										onChange={(e) => setEditSuccessMessage(e.target.value)}
										rows={2}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
							</div>
							<div className="mt-4 grid gap-4 sm:grid-cols-2">
								<label className="block">
									<span className="mb-1 block font-medium text-sm">
										Max Submissions (0 = unlimited)
									</span>
									<input
										type="number"
										min={0}
										value={editMaxSubmissions}
										onChange={(e) =>
											setEditMaxSubmissions(
												Number.parseInt(e.target.value, 10) || 0,
											)
										}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									/>
								</label>
								<div className="flex items-end pb-1">
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={editHoneypotEnabled}
											onChange={(e) => setEditHoneypotEnabled(e.target.checked)}
											className="rounded"
										/>
										Enable honeypot spam protection
									</label>
								</div>
							</div>
						</div>
					) : null}
				</div>

				{/* Right sidebar */}
				<div className="space-y-6">
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h3>
						<dl className="space-y-2 text-sm">
							<div>
								<dt className="text-muted-foreground">Status</dt>
								<dd className="font-medium text-foreground">
									{form.isActive ? "Active" : "Inactive"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Slug</dt>
								<dd className="font-medium font-mono text-foreground">
									{form.slug}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Fields</dt>
								<dd className="font-medium text-foreground">
									{form.fields.length}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Submit Label</dt>
								<dd className="font-medium text-foreground">
									{form.submitLabel}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Honeypot</dt>
								<dd className="font-medium text-foreground">
									{form.honeypotEnabled ? "Enabled" : "Disabled"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Max Submissions</dt>
								<dd className="font-medium text-foreground">
									{form.maxSubmissions === 0
										? "Unlimited"
										: form.maxSubmissions}
								</dd>
							</div>
							{form.notifyEmail ? (
								<div>
									<dt className="text-muted-foreground">Notify Email</dt>
									<dd className="font-medium text-foreground">
										{form.notifyEmail}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium text-foreground">
									{formatDate(form.createdAt)}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Updated</dt>
								<dd className="font-medium text-foreground">
									{formatDate(form.updatedAt)}
								</dd>
							</div>
						</dl>
					</div>

					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Success Message
						</h3>
						<p className="text-foreground text-sm">{form.successMessage}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
