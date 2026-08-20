"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFormsApi() {
	const client = useModuleClient();
	return {
		list: client.module("forms").admin["/admin/forms"],
		create: client.module("forms").admin["/admin/forms/create"],
		stats: client.module("forms").admin["/admin/forms/stats"],
		detail: client.module("forms").admin["/admin/forms/:id"],
		update: client.module("forms").admin["/admin/forms/:id/update"],
		deleteForm: client.module("forms").admin["/admin/forms/:id/delete"],
		submissions:
			client.module("forms").admin["/admin/forms/:formId/submissions"],
		updateStatus:
			client.module("forms").admin["/admin/forms/submissions/:id/status"],
		deleteSubmission:
			client.module("forms").admin["/admin/forms/submissions/:id/delete"],
		bulkDelete:
			client.module("forms").admin["/admin/forms/submissions/bulk-delete"],
	};
}

export interface Form {
	id: string;
	name: string;
	slug: string;
	description?: string;
	fields: FormField[];
	submitLabel: string;
	successMessage: string;
	isActive: boolean;
	notifyEmail?: string;
	honeypotEnabled: boolean;
	maxSubmissions: number;
	createdAt: string;
	updatedAt: string;
}

export function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export interface FormField {
	name: string;
	label: string;
	type: string;
	required: boolean;
	placeholder?: string;
	defaultValue?: string;
	options?: string[];
	pattern?: string;
	min?: number;
	max?: number;
	position: number;
}

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export function FieldBuilder({
	fields,
	onChange,
}: {
	fields: FormField[];
	onChange: (fields: FormField[]) => void;
}) {
	const addField = () => {
		const pos = fields.length;
		onChange([
			...fields,
			{
				name: `field_${pos}`,
				label: `Field ${pos + 1}`,
				type: "text",
				required: false,
				position: pos,
			},
		]);
	};

	const updateField = (idx: number, patch: Partial<FormField>) => {
		const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
		onChange(next);
	};

	const removeField = (idx: number) => {
		onChange(
			fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, position: i })),
		);
	};

	const moveField = (idx: number, dir: -1 | 1) => {
		const next = [...fields];
		const target = idx + dir;
		if (target < 0 || target >= next.length) return;
		const tmp = next[idx];
		next[idx] = next[target];
		next[target] = tmp;
		onChange(next.map((f, i) => ({ ...f, position: i })));
	};

	return (
		<div className="space-y-3">
			{fields.map((field, idx) => (
				<div
					key={`field-${field.position}`}
					className="rounded-lg border border-border bg-muted/20 p-3"
				>
					<div className="mb-2 flex items-center justify-between gap-2">
						<span className="font-medium text-foreground text-xs">
							Field {idx + 1}
						</span>
						<div className="flex gap-1">
							<button
								type="button"
								onClick={() => moveField(idx, -1)}
								disabled={idx === 0}
								className="rounded px-1.5 py-0.5 text-muted-foreground text-xs hover:bg-muted disabled:opacity-30"
							>
								&uarr;
							</button>
							<button
								type="button"
								onClick={() => moveField(idx, 1)}
								disabled={idx === fields.length - 1}
								className="rounded px-1.5 py-0.5 text-muted-foreground text-xs hover:bg-muted disabled:opacity-30"
							>
								&darr;
							</button>
							<button
								type="button"
								onClick={() => removeField(idx)}
								className="rounded px-1.5 py-0.5 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
							>
								Remove
							</button>
						</div>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						<input
							type="text"
							value={field.label}
							onChange={(e) =>
								updateField(idx, {
									label: e.target.value,
									name: slugify(e.target.value) || field.name,
								})
							}
							placeholder="Label"
							className="rounded-md border border-border bg-background px-2 py-1 text-sm"
						/>
						<select
							value={field.type}
							onChange={(e) => updateField(idx, { type: e.target.value })}
							className="rounded-md border border-border bg-background px-2 py-1 text-sm"
						>
							{FIELD_TYPES.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
						<input
							type="text"
							value={field.placeholder ?? ""}
							onChange={(e) => {
								const val = e.target.value;
								updateField(
									idx,
									val ? { placeholder: val } : { placeholder: "" },
								);
							}}
							placeholder="Placeholder"
							className="rounded-md border border-border bg-background px-2 py-1 text-sm"
						/>
						<label className="flex items-center gap-1.5 text-sm">
							<input
								type="checkbox"
								checked={field.required}
								onChange={(e) =>
									updateField(idx, { required: e.target.checked })
								}
								className="rounded"
							/>
							Required
						</label>
					</div>
					{(field.type === "select" || field.type === "radio") && (
						<div className="mt-2">
							<input
								type="text"
								value={(field.options ?? []).join(", ")}
								onChange={(e) =>
									updateField(idx, {
										options: e.target.value
											.split(",")
											.map((s) => s.trim())
											.filter(Boolean),
									})
								}
								placeholder="Options (comma-separated)"
								className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
							/>
						</div>
					)}
				</div>
			))}
			<button
				type="button"
				onClick={addField}
				className="rounded-lg border border-border border-dashed px-3 py-2 text-muted-foreground text-sm hover:border-foreground hover:text-foreground"
			>
				+ Add field
			</button>
		</div>
	);
}

export const FIELD_TYPES = [
	"text",
	"email",
	"textarea",
	"number",
	"phone",
	"select",
	"radio",
	"checkbox",
	"date",
	"url",
	"hidden",
] as const;
