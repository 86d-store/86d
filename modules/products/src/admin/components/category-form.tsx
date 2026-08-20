"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import CategoryFormTemplate from "./category-form.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	parentId?: string | null;
	image?: string | null;
	position: number;
	isVisible: boolean;
}

interface CategoryFormData {
	name: string;
	slug: string;
	description: string;
	parentId: string;
	image: string;
	position: string;
	isVisible: boolean;
}

const LOADING_SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

interface CategoryFormProps {
	categoryId?: string;
	onSuccess?: () => void;
}

interface CategoriesResult {
	categories: Category[];
	total: number;
}

// ─── Module Client ───────────────────────────────────────────────────────────

function useCategoriesAdminApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("products").admin["/admin/categories/list"],
		createCategory: client.module("products").admin["/admin/categories/create"],
		updateCategory:
			client.module("products").admin["/admin/categories/:id/update"],
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

const defaultForm: CategoryFormData = {
	name: "",
	slug: "",
	description: "",
	parentId: "",
	image: "",
	position: "0",
	isVisible: true,
};

// ─── CategoryForm ─────────────────────────────────────────────────────────────

export function CategoryForm({ categoryId, onSuccess }: CategoryFormProps) {
	const api = useCategoriesAdminApi();
	const isEditing = Boolean(categoryId);

	const [form, setForm] = useState<CategoryFormData>(defaultForm);
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [slugEdited, setSlugEdited] = useState(false);

	// Fetch all categories (also provides the editing category data)
	const { data: categoriesData, isLoading: loading } =
		api.listCategories.useQuery({
			limit: "100",
		}) as { data: CategoriesResult | undefined; isLoading: boolean };

	const categories = (categoriesData?.categories ?? []).filter(
		(c) => c.id !== categoryId,
	);

	// Populate form when editing and data arrives
	if (isEditing && categoryId && categoriesData && !initialized) {
		const c = categoriesData.categories.find(
			(cat: Category) => cat.id === categoryId,
		);
		if (c) {
			setForm({
				name: c.name,
				slug: c.slug,
				description: c.description ?? "",
				parentId: c.parentId ?? "",
				image: c.image ?? "",
				position: String(c.position),
				isVisible: c.isVisible,
			});
			setSlugEdited(true);
		}
		setInitialized(true);
	}

	const createMutation = api.createCategory.useMutation({
		onSuccess: () => {
			void api.listCategories.invalidate();
			onSuccess?.();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save category"));
		},
	});

	const updateMutation = api.updateCategory.useMutation({
		onSuccess: () => {
			void api.listCategories.invalidate();
			onSuccess?.();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save category"));
		},
	});

	const saving = createMutation.isPending || updateMutation.isPending;

	const setField = useCallback(
		<K extends keyof CategoryFormData>(
			field: K,
			value: CategoryFormData[K],
		) => {
			setForm((prev) => {
				const next = { ...prev, [field]: value };
				if (field === "name" && !slugEdited) {
					next.slug = slugify(value as string);
				}
				return next;
			});
		},
		[slugEdited],
	);

	const handleSubmit = (e: React.FormEvent) => {
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
			image: form.image.trim() || undefined,
			position: Number.parseInt(form.position, 10) || 0,
			isVisible: form.isVisible,
		};

		if (isEditing && categoryId) {
			updateMutation.mutate({ params: { id: categoryId }, ...body });
		} else {
			createMutation.mutate(body);
		}
	};

	if (loading) {
		return (
			<div className="space-y-4">
				{LOADING_SKELETON_IDS.map((id) => (
					<div
						key={`field-skeleton-${id}`}
						className="h-12 animate-pulse rounded-md bg-muted"
					/>
				))}
			</div>
		);
	}

	const formContent = (
		<>
			<div className="rounded-lg border border-border bg-card p-5">
				<h2 className="mb-4 font-semibold text-foreground text-sm">
					{isEditing ? "Edit category" : "New category"}
				</h2>
				<div className="space-y-4">
					{/* Name */}
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
							onChange={(e) => setField("name", e.target.value)}
							placeholder="Category name"
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							required
						/>
					</div>

					{/* Slug */}
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
								setField("slug", e.target.value);
							}}
							placeholder="category-slug"
							className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							required
						/>
					</div>

					{/* Description */}
					<div>
						<label
							htmlFor="cat-desc"
							className="mb-1.5 block font-medium text-foreground text-sm"
						>
							Description
						</label>
						<textarea
							id="cat-desc"
							value={form.description}
							onChange={(e) => setField("description", e.target.value)}
							placeholder="Category description"
							rows={3}
							className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					{/* Parent category */}
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
							onChange={(e) => setField("parentId", e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">None</option>
							{categories.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</div>

					{/* Image */}
					<CategoryImageField
						image={form.image}
						onChange={(url) => setField("image", url)}
					/>

					{/* Position */}
					<div>
						<label
							htmlFor="cat-position"
							className="mb-1.5 block font-medium text-foreground text-sm"
						>
							Position
						</label>
						<input
							id="cat-position"
							type="number"
							min="0"
							value={form.position}
							onChange={(e) => setField("position", e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							Lower numbers appear first
						</p>
					</div>

					{/* Visible */}
					<label className="flex items-center gap-2.5">
						<input
							type="checkbox"
							checked={form.isVisible}
							onChange={(e) => setField("isVisible", e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						<span className="text-foreground text-sm">
							Visible on storefront
						</span>
					</label>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={saving}
					className="rounded-md bg-foreground px-4 py-2.5 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{saving
						? "Saving..."
						: isEditing
							? "Save changes"
							: "Create category"}
				</button>
				{onSuccess && (
					<button
						type="button"
						onClick={onSuccess}
						className="rounded-md border border-border px-4 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						Cancel
					</button>
				)}
			</div>
		</>
	);

	return (
		<form onSubmit={(e) => handleSubmit(e)} className="space-y-5">
			<CategoryFormTemplate error={error} formContent={formContent} />
		</form>
	);
}

// ─── Inline image upload for categories ──────────────────────────────────────

function CategoryImageField({
	image,
	onChange,
}: {
	image: string;
	onChange: (url: string) => void;
}) {
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = async (file: File) => {
		setUploadError(null);
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", file);
			const res = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				throw new Error(data.error ?? "Upload failed");
			}
			const data = (await res.json()) as { url: string };
			onChange(data.url);
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	return (
		<div>
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				Image
			</span>
			{image ? (
				<div className="flex items-start gap-3">
					<div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
						<Image
							src={image}
							alt="Category"
							width={80}
							height={80}
							unoptimized
							className="h-full w-full object-cover"
						/>
					</div>
					<button
						type="button"
						onClick={() => onChange("")}
						className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Remove
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={uploading}
					className="flex h-20 w-20 flex-col items-center justify-center rounded-md border-2 border-border border-dashed text-muted-foreground transition-colors hover:border-muted-foreground hover:bg-muted/30 disabled:opacity-60"
				>
					{uploading ? (
						<svg
							className="h-5 w-5 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
					) : (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<rect width="18" height="18" x="3" y="3" rx="2" />
								<circle cx="9" cy="9" r="2" />
								<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
							</svg>
							<span className="mt-0.5 text-2xs">Upload</span>
						</>
					)}
				</button>
			)}
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) void handleFile(file);
				}}
			/>
			{uploadError && (
				<p className="mt-1 text-destructive text-xs">{uploadError}</p>
			)}
		</div>
	);
}
