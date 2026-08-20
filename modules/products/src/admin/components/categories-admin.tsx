"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CategoriesAdminTemplate from "./categories-admin.mdx";

interface Category {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	parentId?: string | null;
	isVisible: boolean;
	position: number;
}

interface ListResult {
	categories: Category[];
	total: number;
}

const ROW_SKELETON_IDS = ["a", "b", "c", "d"] as const;
const CELL_SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

// ─── Module Client ───────────────────────────────────────────────────────────

function useCategoriesAdminApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("products").admin["/admin/categories/list"],
		createCategory: client.module("products").admin["/admin/categories/create"],
		updateCategory:
			client.module("products").admin["/admin/categories/:id/update"],
		deleteCategory:
			client.module("products").admin["/admin/categories/:id/delete"],
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function slugify(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function CategoriesAdmin() {
	const api = useCategoriesAdminApi();

	const [showForm, setShowForm] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: "",
		slug: "",
		description: "",
		parentId: "",
		isVisible: true,
	});
	const [error, setError] = useState<string | null>(null);
	const [slugEdited, setSlugEdited] = useState(false);

	const { data: categoriesData, isLoading: loading } =
		api.listCategories.useQuery({
			limit: "100",
			sort: "position",
			order: "asc",
		}) as { data: ListResult | undefined; isLoading: boolean };

	const categories = categoriesData?.categories ?? [];
	const total = categoriesData?.total ?? 0;

	const createMutation = api.createCategory.useMutation({
		onSuccess: () => {
			setShowForm(false);
			setEditId(null);
			void api.listCategories.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save category"));
		},
	});

	const updateMutation = api.updateCategory.useMutation({
		onSuccess: () => {
			setShowForm(false);
			setEditId(null);
			void api.listCategories.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save category"));
		},
	});

	const deleteMutation = api.deleteCategory.useMutation({
		onSettled: () => {
			void api.listCategories.invalidate();
		},
	});

	const saving = createMutation.isPending || updateMutation.isPending;

	const openCreate = () => {
		setForm({
			name: "",
			slug: "",
			description: "",
			parentId: "",
			isVisible: true,
		});
		setSlugEdited(false);
		setEditId(null);
		setError(null);
		setShowForm(true);
	};

	const openEdit = (cat: Category) => {
		setForm({
			name: cat.name,
			slug: cat.slug,
			description: cat.description ?? "",
			parentId: cat.parentId ?? "",
			isVisible: cat.isVisible,
		});
		setSlugEdited(true);
		setEditId(cat.id);
		setError(null);
		setShowForm(true);
	};

	const handleNameChange = (name: string) => {
		setForm((prev) => ({
			...prev,
			name,
			slug: slugEdited ? prev.slug : slugify(name),
		}));
	};

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!form.name.trim()) {
			setError("Name is required");
			return;
		}
		if (!form.slug.trim()) {
			setError("Slug is required");
			return;
		}

		const body = {
			name: form.name.trim(),
			slug: form.slug.trim(),
			description: form.description.trim() || undefined,
			parentId: form.parentId || undefined,
			isVisible: form.isVisible,
		};

		if (editId) {
			updateMutation.mutate({ params: { id: editId }, ...body });
		} else {
			createMutation.mutate(body);
		}
	};

	const handleDelete = (cat: Category) => {
		if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
		deleteMutation.mutate({ params: { id: cat.id } });
	};

	const content = (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Categories</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{total} {total === 1 ? "category" : "categories"}
					</p>
				</div>
				<button
					type="button"
					onClick={openCreate}
					className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M5 12h14" />
						<path d="M12 5v14" />
					</svg>
					Add category
				</button>
			</div>

			{/* Inline form */}
			{showForm && (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						{editId ? "Edit category" : "New category"}
					</h2>
					<form onSubmit={(e) => handleSave(e)} className="space-y-4">
						{error && (
							<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
								{error}
							</p>
						)}
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label
									htmlFor="cat-name"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									id="cat-name"
									type="text"
									value={form.name}
									onChange={(e) => handleNameChange(e.target.value)}
									placeholder="Category name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>
							<div>
								<label
									htmlFor="cat-slug"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Slug <span className="text-destructive">*</span>
								</label>
								<input
									id="cat-slug"
									type="text"
									value={form.slug}
									onChange={(e) => {
										setSlugEdited(true);
										setForm((p) => ({ ...p, slug: e.target.value }));
									}}
									placeholder="category-slug"
									className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>
						</div>
						<div>
							<label
								htmlFor="cat-desc"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								Description
							</label>
							<input
								id="cat-desc"
								type="text"
								value={form.description}
								onChange={(e) =>
									setForm((p) => ({ ...p, description: e.target.value }))
								}
								placeholder="Optional description"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label
									htmlFor="cat-parent"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Parent category
								</label>
								<select
									id="cat-parent"
									value={form.parentId}
									onChange={(e) =>
										setForm((p) => ({ ...p, parentId: e.target.value }))
									}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="">No parent</option>
									{categories
										.filter((c) => c.id !== editId)
										.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
								</select>
							</div>
							<div className="flex items-end">
								<label className="flex items-center gap-2.5 pb-2">
									<input
										type="checkbox"
										checked={form.isVisible}
										onChange={(e) =>
											setForm((p) => ({ ...p, isVisible: e.target.checked }))
										}
										className="h-4 w-4 rounded border-border"
									/>
									<span className="text-foreground text-sm">
										Visible in store
									</span>
								</label>
							</div>
						</div>
						<div className="flex gap-2 pt-1">
							<button
								type="submit"
								disabled={saving}
								className="rounded-md bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{saving
									? "Saving..."
									: editId
										? "Save changes"
										: "Create category"}
							</button>
							<button
								type="button"
								onClick={() => setShowForm(false)}
								className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Name
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Slug
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Parent
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Visible
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							ROW_SKELETON_IDS.map((rowId) => (
								<tr key={`skeleton-${rowId}`}>
									{CELL_SKELETON_IDS.map((cellId) => (
										<td key={`skeleton-cell-${cellId}`} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : categories.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No categories yet
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Create your first category to organize your products
									</p>
									<button
										type="button"
										onClick={openCreate}
										className="mt-3 font-medium text-foreground text-sm underline underline-offset-2"
									>
										Add category
									</button>
								</td>
							</tr>
						) : (
							categories.map((cat) => {
								const parent = categories.find((c) => c.id === cat.parentId);
								return (
									<tr
										key={cat.id}
										className="transition-colors hover:bg-muted/30"
									>
										<td className="px-4 py-3 font-medium text-foreground text-sm">
											{cat.name}
										</td>
										<td className="hidden px-4 py-3 font-mono text-muted-foreground text-xs sm:table-cell">
											{cat.slug}
										</td>
										<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
											{parent?.name ?? "—"}
										</td>
										<td className="hidden px-4 py-3 text-center lg:table-cell">
											<span
												className={`inline-flex h-2 w-2 rounded-full ${cat.isVisible ? "bg-green-500" : "bg-muted-foreground"}`}
											/>
										</td>
										<td className="px-4 py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<button
													type="button"
													onClick={() => openEdit(cat)}
													className="rounded-md px-2.5 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted"
												>
													Edit
												</button>
												<button
													type="button"
													onClick={() => handleDelete(cat)}
													className="rounded-md px-2.5 py-1.5 font-medium text-destructive text-xs transition-colors hover:bg-destructive/10"
												>
													Delete
												</button>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);

	return <CategoriesAdminTemplate content={content} />;
}
