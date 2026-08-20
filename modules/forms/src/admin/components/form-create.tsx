"use client";

import { useState } from "react";
import {
	extractError,
	FieldBuilder,
	type Form,
	type FormField,
	slugify,
	useFormsApi,
} from "./_shared";

export function FormCreate() {
	const api = useFormsApi();
	const createMutation = api.create.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<{
			form?: Form;
		}>;
		isPending: boolean;
	};

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [submitLabel, setSubmitLabel] = useState("Submit");
	const [successMessage, setSuccessMessage] = useState(
		"Thank you for your submission.",
	);
	const [notifyEmail, setNotifyEmail] = useState("");
	const [honeypotEnabled, setHoneypotEnabled] = useState(true);
	const [maxSubmissions, setMaxSubmissions] = useState(0);
	const [fields, setFields] = useState<FormField[]>([]);
	const [error, setError] = useState("");

	const handleNameChange = (val: string) => {
		setName(val);
		setSlug(slugify(val));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!name.trim() || !slug.trim()) {
			setError("Name and slug are required.");
			return;
		}

		try {
			const result = await createMutation.mutateAsync({
				body: {
					name: name.trim(),
					slug: slug.trim(),
					description: description.trim() || undefined,
					fields,
					submitLabel: submitLabel.trim(),
					successMessage: successMessage.trim(),
					notifyEmail: notifyEmail.trim() || undefined,
					honeypotEnabled,
					maxSubmissions,
				},
			});

			if (result.form) {
				window.location.href = `/admin/forms/${result.form.id}`;
			}
		} catch (err) {
			setError(extractError(err));
		}
	};

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

			<h1 className="mb-6 font-bold text-2xl text-foreground">Create Form</h1>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Basic info */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Basic Information
					</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Name</span>
							<input
								type="text"
								value={name}
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder="Contact Us"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Slug</span>
							<input
								type="text"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="contact-us"
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
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Optional description"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
					</div>
				</div>

				{/* Fields */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Form Fields
					</h2>
					<FieldBuilder fields={fields} onChange={setFields} />
				</div>

				{/* Settings */}
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Settings
					</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Submit Button Label
							</span>
							<input
								type="text"
								value={submitLabel}
								onChange={(e) => setSubmitLabel(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Notification Email
							</span>
							<input
								type="email"
								value={notifyEmail}
								onChange={(e) => setNotifyEmail(e.target.value)}
								placeholder="admin@example.com"
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
								value={successMessage}
								onChange={(e) => setSuccessMessage(e.target.value)}
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
								value={maxSubmissions}
								onChange={(e) =>
									setMaxSubmissions(Number.parseInt(e.target.value, 10) || 0)
								}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<div className="flex items-end pb-1">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={honeypotEnabled}
									onChange={(e) => setHoneypotEnabled(e.target.checked)}
									className="rounded"
								/>
								Enable honeypot spam protection
							</label>
						</div>
					</div>
				</div>

				<div className="flex gap-3">
					<button
						type="submit"
						disabled={createMutation.isPending}
						className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
					>
						{createMutation.isPending ? "Creating..." : "Create Form"}
					</button>
					<a
						href="/admin/forms"
						className="rounded-lg border border-border bg-card px-4 py-2 text-foreground text-sm hover:bg-muted"
					>
						Cancel
					</a>
				</div>
			</form>
		</div>
	);
}
