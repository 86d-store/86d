"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
	id: string;
	name: string;
}

interface Product {
	name: string;
	slug: string;
	description?: string | null;
	shortDescription?: string | null;
	price: number;
	compareAtPrice?: number | null;
	sku?: string | null;
	inventory: number;
	trackInventory: boolean;
	allowBackorder: boolean;
	status: "draft" | "active" | "archived";
	categoryId?: string | null;
	isFeatured: boolean;
	tags: string[];
	images: string[];
}

interface ProductFormData {
	name: string;
	slug: string;
	description: string;
	shortDescription: string;
	price: string;
	compareAtPrice: string;
	sku: string;
	inventory: string;
	trackInventory: boolean;
	allowBackorder: boolean;
	status: "draft" | "active" | "archived";
	categoryId: string;
	isFeatured: boolean;
	tags: string;
	images: string[];
}

interface ProductFormProps {
	productId?: string;
	onNavigate: (path: string) => void;
}

interface CategoriesResult {
	categories: Category[];
}

// ─── Module Client ───────────────────────────────────────────────────────────

function useProductsAdminApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("products").admin["/admin/categories/list"],
		getProduct: client.module("products").admin["/admin/products/:id"],
		createProduct: client.module("products").admin["/admin/products/create"],
		updateProduct:
			client.module("products").admin["/admin/products/:id/update"],
		listProducts: client.module("products").admin["/admin/products/list"],
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

const defaultForm: ProductFormData = {
	name: "",
	slug: "",
	description: "",
	shortDescription: "",
	price: "",
	compareAtPrice: "",
	sku: "",
	inventory: "0",
	trackInventory: true,
	allowBackorder: false,
	status: "draft",
	categoryId: "",
	isFeatured: false,
	tags: "",
	images: [],
};

// ─── ImageUpload (self-contained) ────────────────────────────────────────────

function ImageUpload({
	images,
	onChange,
	max = 10,
}: {
	images: string[];
	onChange: (images: string[]) => void;
	max?: number;
}) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const uploadFile = useCallback(async (file: File): Promise<string | null> => {
		const formData = new FormData();
		formData.append("file", file);
		const res = await fetch("/api/upload", { method: "POST", body: formData });
		if (!res.ok) {
			const data = (await res.json()) as { error?: string };
			throw new Error(data.error ?? "Upload failed");
		}
		const data = (await res.json()) as { url: string };
		return data.url;
	}, []);

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
			const remaining = max - images.length;
			if (remaining <= 0) {
				setError(`Maximum ${max} images allowed`);
				return;
			}
			const toUpload = Array.from(files).slice(0, remaining);
			setError(null);
			setUploading(true);
			try {
				const urls: string[] = [];
				for (const file of toUpload) {
					const url = await uploadFile(file);
					if (url) urls.push(url);
				}
				onChange([...images, ...urls]);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
			} finally {
				setUploading(false);
				if (inputRef.current) inputRef.current.value = "";
			}
		},
		[images, max, onChange, uploadFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			if (e.dataTransfer.files.length > 0) {
				void handleFiles(e.dataTransfer.files);
			}
		},
		[handleFiles],
	);

	const handleRemove = useCallback(
		(index: number) => {
			onChange(images.filter((_, i) => i !== index));
		},
		[images, onChange],
	);

	return (
		<div>
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				Images
			</span>

			{images.length > 0 && (
				<div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
					{images.map((url, i) => (
						<div key={url} className="group relative">
							<div className="aspect-square overflow-hidden rounded-md border border-border bg-muted">
								<Image
									src={url}
									alt={`Upload ${i + 1}`}
									width={400}
									height={400}
									unoptimized
									className="h-full w-full object-cover"
								/>
							</div>
							<button
								type="button"
								onClick={() => handleRemove(i)}
								className="absolute top-1 right-1 rounded bg-destructive/90 p-0.5 text-white opacity-0 shadow-sm transition-opacity hover:bg-destructive group-hover:opacity-100"
								title="Remove"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M18 6 6 18" />
									<path d="m6 6 12 12" />
								</svg>
							</button>
							{i === 0 && (
								<span className="absolute bottom-1 left-1 rounded bg-foreground/80 px-1 py-0.5 font-medium text-2xs text-background">
									Primary
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{images.length < max && (
				<button
					type="button"
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
						dragOver
							? "border-foreground/50 bg-muted/50"
							: "border-border hover:border-muted-foreground hover:bg-muted/30"
					} ${uploading ? "pointer-events-none opacity-60" : ""}`}
					onClick={() => inputRef.current?.click()}
				>
					{uploading ? (
						<span className="text-muted-foreground text-sm">Uploading...</span>
					) : (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="mb-2 text-muted-foreground"
								aria-hidden="true"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="17 8 12 3 7 8" />
								<line x1="12" y1="3" x2="12" y2="15" />
							</svg>
							<p className="text-muted-foreground text-sm">
								Drop images here or click to browse
							</p>
							<p className="mt-1 text-muted-foreground/70 text-xs">
								JPEG, PNG, WebP up to 4.5 MB
							</p>
						</>
					)}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				className="hidden"
				onChange={(e) => {
					if (e.target.files && e.target.files.length > 0) {
						void handleFiles(e.target.files);
					}
				}}
			/>

			{error && <p className="mt-1.5 text-destructive text-xs">{error}</p>}
		</div>
	);
}

// ─── ProductForm ─────────────────────────────────────────────────────────────

export function ProductForm({ productId, onNavigate }: ProductFormProps) {
	const api = useProductsAdminApi();
	const isEditing = Boolean(productId);

	const [form, setForm] = useState<ProductFormData>(defaultForm);
	const [error, setError] = useState<string | null>(null);
	const [slugEdited, setSlugEdited] = useState(false);

	const { data: categoriesData } = api.listCategories.useQuery({
		limit: "100",
	}) as { data: CategoriesResult | undefined; isLoading: boolean };

	const categories = categoriesData?.categories ?? [];

	interface ProductResult {
		product?: Product | undefined;
	}
	const { data: productData, isLoading: loading } = api.getProduct.useQuery(
		productId ? { params: { id: productId } } : undefined,
	) as {
		data: ProductResult | undefined;
		isLoading: boolean;
	};

	const hydrated = useRef(false);
	useEffect(() => {
		if (!productData?.product || hydrated.current) return;
		hydrated.current = true;
		const p = productData.product;
		setForm({
			name: p.name,
			slug: p.slug,
			description: p.description ?? "",
			shortDescription: p.shortDescription ?? "",
			price: String(p.price / 100),
			compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice / 100) : "",
			sku: p.sku ?? "",
			inventory: String(p.inventory),
			trackInventory: p.trackInventory,
			allowBackorder: p.allowBackorder,
			status: p.status,
			categoryId: p.categoryId ?? "",
			isFeatured: p.isFeatured,
			tags: p.tags.join(", "),
			images: p.images ?? [],
		});
		setSlugEdited(true);
	}, [productData]);

	const createMutation = api.createProduct.useMutation({
		onSuccess: () => {
			void api.listProducts.invalidate();
			onNavigate("/admin/products");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save product"));
		},
	});

	const updateMutation = api.updateProduct.useMutation({
		onSuccess: () => {
			void api.listProducts.invalidate();
			void api.getProduct.invalidate();
			onNavigate("/admin/products");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to save product"));
		},
	});

	const saving = createMutation.isPending || updateMutation.isPending;

	const setField = useCallback(
		<K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
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
		const price = Math.round(Number.parseFloat(form.price) * 100);
		if (Number.isNaN(price) || price <= 0) {
			setError("Price must be a positive number");
			return;
		}

		const body = {
			name: form.name.trim(),
			slug: form.slug.trim(),
			description: form.description.trim() || undefined,
			shortDescription: form.shortDescription.trim() || undefined,
			price,
			compareAtPrice: form.compareAtPrice
				? Math.round(Number.parseFloat(form.compareAtPrice) * 100)
				: undefined,
			sku: form.sku.trim() || undefined,
			inventory: Number.parseInt(form.inventory, 10) || 0,
			trackInventory: form.trackInventory,
			allowBackorder: form.allowBackorder,
			status: form.status,
			categoryId: form.categoryId || undefined,
			isFeatured: form.isFeatured,
			tags: form.tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			images: form.images,
		};

		if (isEditing && productId) {
			updateMutation.mutate({ params: { id: productId }, ...body });
		} else {
			createMutation.mutate(body);
		}
	};

	if (loading && isEditing) {
		return (
			<div className="space-y-4">
				{Array.from({ length: 6 }, (_, i) => `product-form-skel-${i}`).map(
					(id) => (
						<div key={id} className="h-12 animate-pulse rounded-md bg-muted" />
					),
				)}
			</div>
		);
	}

	return (
		<form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
			{error && (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main column */}
				<div className="space-y-5 lg:col-span-2">
					{/* Basic info */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Product details
						</h2>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="pf-name"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Name <span className="text-destructive">*</span>
								</label>
								<input
									id="pf-name"
									type="text"
									value={form.name}
									onChange={(e) => setField("name", e.target.value)}
									placeholder="Product name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>

							<div>
								<label
									htmlFor="pf-slug"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Slug <span className="text-destructive">*</span>
								</label>
								<input
									id="pf-slug"
									type="text"
									value={form.slug}
									onChange={(e) => {
										setSlugEdited(true);
										setField("slug", e.target.value);
									}}
									placeholder="product-slug"
									className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>

							<div>
								<label
									htmlFor="pf-short-desc"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Short description
								</label>
								<input
									id="pf-short-desc"
									type="text"
									value={form.shortDescription}
									onChange={(e) => setField("shortDescription", e.target.value)}
									placeholder="Brief product description"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>

							<div>
								<label
									htmlFor="pf-description"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Description
								</label>
								<textarea
									id="pf-description"
									value={form.description}
									onChange={(e) => setField("description", e.target.value)}
									placeholder="Full product description"
									rows={5}
									className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
						</div>
					</div>

					{/* Images */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Media
						</h2>
						<ImageUpload
							images={form.images}
							onChange={(images) => setForm((prev) => ({ ...prev, images }))}
							max={10}
						/>
					</div>

					{/* Pricing */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Pricing
						</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label
									htmlFor="pf-price"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Price (USD) <span className="text-destructive">*</span>
								</label>
								<div className="relative">
									<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
										$
									</span>
									<input
										id="pf-price"
										type="number"
										min="0"
										step="0.01"
										value={form.price}
										onChange={(e) => setField("price", e.target.value)}
										placeholder="0.00"
										className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-7 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										required
									/>
								</div>
							</div>

							<div>
								<label
									htmlFor="pf-compare-price"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Compare-at price
								</label>
								<div className="relative">
									<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
										$
									</span>
									<input
										id="pf-compare-price"
										type="number"
										min="0"
										step="0.01"
										value={form.compareAtPrice}
										onChange={(e) => setField("compareAtPrice", e.target.value)}
										placeholder="0.00"
										className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-7 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									Shows a strikethrough price on the storefront
								</p>
							</div>
						</div>
					</div>

					{/* Inventory */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Inventory
						</h2>
						<div className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<label
										htmlFor="pf-sku"
										className="mb-1.5 block font-medium text-foreground text-sm"
									>
										SKU
									</label>
									<input
										id="pf-sku"
										type="text"
										value={form.sku}
										onChange={(e) => setField("sku", e.target.value)}
										placeholder="SKU-001"
										className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>

								<div>
									<label
										htmlFor="pf-inventory"
										className="mb-1.5 block font-medium text-foreground text-sm"
									>
										Quantity
									</label>
									<input
										id="pf-inventory"
										type="number"
										min="0"
										value={form.inventory}
										onChange={(e) => setField("inventory", e.target.value)}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<label className="flex items-center gap-2.5">
									<input
										type="checkbox"
										checked={form.trackInventory}
										onChange={(e) =>
											setField("trackInventory", e.target.checked)
										}
										className="h-4 w-4 rounded border-border"
									/>
									<span className="text-foreground text-sm">
										Track inventory
									</span>
								</label>
								<label className="flex items-center gap-2.5">
									<input
										type="checkbox"
										checked={form.allowBackorder}
										onChange={(e) =>
											setField("allowBackorder", e.target.checked)
										}
										className="h-4 w-4 rounded border-border"
									/>
									<span className="text-foreground text-sm">
										Allow backorders
									</span>
								</label>
							</div>
						</div>
					</div>
				</div>

				{/* Sidebar column */}
				<div className="space-y-5">
					{/* Status */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Status
						</h2>
						<select
							value={form.status}
							onChange={(e) =>
								setField("status", e.target.value as ProductFormData["status"])
							}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="draft">Draft</option>
							<option value="active">Active</option>
							<option value="archived">Archived</option>
						</select>
						<p className="mt-2 text-muted-foreground text-xs">
							Only active products are visible in the store.
						</p>
					</div>

					{/* Organization */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Organization
						</h2>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="pf-category"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Category
								</label>
								<select
									id="pf-category"
									value={form.categoryId}
									onChange={(e) => setField("categoryId", e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="">No category</option>
									{categories.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name}
										</option>
									))}
								</select>
							</div>

							<div>
								<label
									htmlFor="pf-tags"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Tags
								</label>
								<input
									id="pf-tags"
									type="text"
									value={form.tags}
									onChange={(e) => setField("tags", e.target.value)}
									placeholder="tag1, tag2, tag3"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Comma-separated
								</p>
							</div>

							<label className="flex items-center gap-2.5">
								<input
									type="checkbox"
									checked={form.isFeatured}
									onChange={(e) => setField("isFeatured", e.target.checked)}
									className="h-4 w-4 rounded border-border"
								/>
								<span className="text-foreground text-sm">
									Featured product
								</span>
							</label>
						</div>
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-2">
						<button
							type="submit"
							disabled={saving}
							className="w-full rounded-md bg-foreground px-4 py-2.5 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{saving
								? "Saving\u2026"
								: isEditing
									? "Save changes"
									: "Create product"}
						</button>
						<button
							type="button"
							onClick={() => onNavigate("/admin/products")}
							className="w-full rounded-md border border-border px-4 py-2.5 text-center font-medium text-foreground text-sm transition-colors hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</form>
	);
}
