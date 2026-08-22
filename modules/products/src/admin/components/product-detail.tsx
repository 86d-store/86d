"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useState } from "react";
import ProductDetailTemplate from "./product-detail.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant {
	id: string;
	productId: string;
	name: string;
	sku: string;
	price: number;
	inventory: number;
	options: Record<string, string>;
	position: number;
}

interface Product {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	price: number;
	compareAtPrice?: number | null;
	status: "draft" | "active" | "archived";
	inventory: number;
	isFeatured: boolean;
	images: string[];
	tags: string[];
	categoryId?: string | null;
	category?: { id: string; name: string; slug: string } | null;
	variants: ProductVariant[];
	createdAt: string;
	updatedAt: string;
}

interface GetProductResult {
	product?: Product;
}

interface VariantOption {
	_uiId: string;
	key: string;
	value: string;
}

interface VariantFormData {
	name: string;
	sku: string;
	price: string;
	inventory: string;
	options: VariantOption[];
}

function createOption(key = "", value = ""): VariantOption {
	return { _uiId: crypto.randomUUID(), key, value };
}

const emptyVariantForm: VariantFormData = {
	name: "",
	sku: "",
	price: "",
	inventory: "0",
	options: [createOption()],
};

// ─── Module Client ───────────────────────────────────────────────────────────

function useProductsAdminApi() {
	const client = useModuleClient();
	return {
		getProduct: client.module("products").admin["/admin/products/:id"],
		deleteProduct:
			client.module("products").admin["/admin/products/:id/delete"],
		createVariant:
			client.module("products").admin["/admin/products/:productId/variants"],
		updateVariant:
			client.module("products").admin["/admin/variants/:id/update"],
		deleteVariant:
			client.module("products").admin["/admin/variants/:id/delete"],
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

const statusStyles: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	active:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	archived:
		"bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

// ─── VariantForm ─────────────────────────────────────────────────────────────

function VariantForm({
	initial,
	onSubmit,
	onCancel,
	submitting,
	submitLabel,
}: {
	initial: VariantFormData;
	onSubmit: (data: VariantFormData) => void;
	onCancel: () => void;
	submitting: boolean;
	submitLabel: string;
}) {
	const [form, setForm] = useState<VariantFormData>(initial);

	const updateField = (field: keyof VariantFormData, value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const updateOption = (idx: number, field: "key" | "value", value: string) => {
		setForm((prev) => {
			const options = [...prev.options];
			options[idx] = { ...options[idx], [field]: value };
			return { ...prev, options };
		});
	};

	const addOption = () => {
		setForm((prev) => ({
			...prev,
			options: [...prev.options, createOption()],
		}));
	};

	const removeOption = (idx: number) => {
		setForm((prev) => ({
			...prev,
			options: prev.options.filter((_, i) => i !== idx),
		}));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(form);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-xs">
						Name *
					</span>
					<input
						type="text"
						value={form.name}
						onChange={(e) => updateField("name", e.target.value)}
						required
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
						placeholder="e.g., Blue / Medium"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-xs">
						SKU
					</span>
					<input
						type="text"
						value={form.sku}
						onChange={(e) => updateField("sku", e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
						placeholder="e.g., PROD-BLU-M"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-xs">
						Price (cents) *
					</span>
					<input
						type="number"
						value={form.price}
						onChange={(e) => updateField("price", e.target.value)}
						required
						min="1"
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
						placeholder="e.g., 2999"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-xs">
						Inventory
					</span>
					<input
						type="number"
						value={form.inventory}
						onChange={(e) => updateField("inventory", e.target.value)}
						min="0"
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
					/>
				</label>
			</div>

			{/* Options */}
			<div>
				<div className="mb-2 flex items-center justify-between">
					<span className="font-medium text-foreground text-xs">Options</span>
					<button
						type="button"
						onClick={addOption}
						className="text-foreground text-xs underline underline-offset-2 hover:opacity-70"
					>
						+ Add option
					</button>
				</div>
				<div className="space-y-2">
					{form.options.map((opt, idx) => (
						<div key={opt._uiId} className="flex gap-2">
							<input
								type="text"
								value={opt.key}
								onChange={(e) => updateOption(idx, "key", e.target.value)}
								placeholder="Key (e.g., Size)"
								className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
							/>
							<input
								type="text"
								value={opt.value}
								onChange={(e) => updateOption(idx, "value", e.target.value)}
								placeholder="Value (e.g., Medium)"
								className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30"
							/>
							{form.options.length > 1 && (
								<button
									type="button"
									onClick={() => removeOption(idx)}
									aria-label="Remove option"
									className="rounded-md px-2 text-muted-foreground hover:text-destructive"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
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
							)}
						</div>
					))}
				</div>
			</div>

			<div className="flex justify-end gap-2 border-border/40 border-t pt-4">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting || !form.name || !form.price}
					className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{submitting ? "Saving..." : submitLabel}
				</button>
			</div>
		</form>
	);
}

// ─── ProductDetail ────────────────────────────────────────────────────────────

interface ProductDetailProps {
	productId?: string;
	params?: Record<string, string>;
}

export function ProductDetail(props: ProductDetailProps) {
	const productId = props.productId ?? props.params?.id;

	const api = useProductsAdminApi();
	const [selectedImage, setSelectedImage] = useState(0);
	const [showVariantForm, setShowVariantForm] = useState(false);
	const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
		null,
	);

	const { data: productData, isLoading: loading } = api.getProduct.useQuery(
		{ params: { id: productId ?? "" } },
		{ enabled: !!productId },
	) as {
		data: GetProductResult | undefined;
		isLoading: boolean;
	};

	const deleteMutation = api.deleteProduct.useMutation({
		onSuccess: () => {
			window.location.href = "/admin/products";
		},
	});

	const createVariantMutation = api.createVariant.useMutation({
		onSuccess: () => {
			setShowVariantForm(false);
			void api.getProduct.invalidate();
		},
	});

	const updateVariantMutation = api.updateVariant.useMutation({
		onSuccess: () => {
			setEditingVariant(null);
			void api.getProduct.invalidate();
		},
	});

	const deleteVariantMutation = api.deleteVariant.useMutation({
		onSuccess: () => {
			void api.getProduct.invalidate();
		},
	});

	const product = productData?.product ?? null;
	const deleting = deleteMutation.isPending;

	const handleDelete = () => {
		if (!window.confirm("Are you sure you want to delete this product?")) {
			return;
		}
		deleteMutation.mutate({ params: { id: productId } });
	};

	const handleCreateVariant = (data: VariantFormData) => {
		const options: Record<string, string> = {};
		for (const opt of data.options) {
			if (opt.key.trim() && opt.value.trim()) {
				options[opt.key.trim()] = opt.value.trim();
			}
		}
		createVariantMutation.mutate({
			params: { productId },
			name: data.name,
			sku: data.sku || undefined,
			price: Number(data.price),
			inventory: Number(data.inventory) || 0,
			options,
		});
	};

	const handleUpdateVariant = (data: VariantFormData) => {
		if (!editingVariant) return;
		const options: Record<string, string> = {};
		for (const opt of data.options) {
			if (opt.key.trim() && opt.value.trim()) {
				options[opt.key.trim()] = opt.value.trim();
			}
		}
		updateVariantMutation.mutate({
			params: { id: editingVariant.id },
			name: data.name,
			sku: data.sku || undefined,
			price: Number(data.price),
			inventory: Number(data.inventory) || 0,
			options,
		});
	};

	const handleDeleteVariant = (variantId: string) => {
		if (!window.confirm("Delete this variant?")) return;
		deleteVariantMutation.mutate({ params: { id: variantId } });
	};

	if (!productId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Product not found</p>
				<p className="mt-1 text-sm">No product ID was provided.</p>
				<a
					href="/admin/products"
					className="mt-3 inline-block text-sm underline"
				>
					Back to products
				</a>
			</div>
		);
	}

	// Loading skeleton
	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="h-7 w-48 animate-pulse rounded bg-muted" />
					<div className="flex gap-2">
						<div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
						<div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
					</div>
				</div>
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-4 lg:col-span-2">
						<div className="aspect-square animate-pulse rounded-lg bg-muted" />
						<div className="h-24 animate-pulse rounded-lg bg-muted" />
					</div>
					<div className="space-y-4">
						<div className="h-32 animate-pulse rounded-lg bg-muted" />
						<div className="h-24 animate-pulse rounded-lg bg-muted" />
					</div>
				</div>
			</div>
		);
	}

	if (!product) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<p className="font-medium text-base text-foreground">
					Product not found
				</p>
				<a
					href="/admin/products"
					className="mt-3 text-foreground text-sm underline underline-offset-2"
				>
					Back to products
				</a>
			</div>
		);
	}

	const content = (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="font-semibold text-foreground text-lg">
						{product.name}
					</h1>
					<span
						className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs capitalize ${
							statusStyles[product.status] ?? statusStyles.draft
						}`}
					>
						{product.status}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<a
						href={`/admin/products/${product.id}/edit`}
						className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						Edit
					</a>
					<button
						type="button"
						onClick={() => handleDelete()}
						disabled={deleting}
						className="rounded-md border border-destructive/50 px-4 py-2 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 disabled:opacity-50"
					>
						{deleting ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main column */}
				<div className="space-y-5 lg:col-span-2">
					{/* Images */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Images
						</h2>
						{product.images.length > 0 ? (
							<div className="space-y-3">
								<div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
									<Image
										src={product.images[selectedImage]}
										alt={product.name}
										width={800}
										height={800}
										unoptimized
										className="h-full w-full object-cover object-center"
									/>
								</div>
								{product.images.length > 1 && (
									<div className="flex gap-2">
										{product.images.map((img, i) => (
											<button
												key={`thumb-${img}`}
												type="button"
												onClick={() => setSelectedImage(i)}
												className={`h-16 w-16 overflow-hidden rounded-md border-2 transition-colors ${
													i === selectedImage
														? "border-foreground"
														: "border-border hover:border-muted-foreground"
												}`}
											>
												<Image
													src={img}
													alt={`${product.name} view ${i + 1}`}
													width={64}
													height={64}
													unoptimized
													className="h-full w-full object-cover"
												/>
											</button>
										))}
									</div>
								)}
							</div>
						) : (
							<div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="40"
									height="40"
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
							</div>
						)}
					</div>

					{/* Description */}
					{product.description && (
						<div className="rounded-lg border border-border bg-card p-5">
							<h2 className="mb-4 font-semibold text-foreground text-sm">
								Description
							</h2>
							<p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
								{product.description}
							</p>
						</div>
					)}

					{/* Variants */}
					<div className="rounded-lg border border-border bg-card p-5">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-foreground text-sm">
								Variants ({product.variants.length})
							</h2>
							{!showVariantForm && !editingVariant && (
								<button
									type="button"
									onClick={() => setShowVariantForm(true)}
									className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs hover:opacity-90"
								>
									+ Add variant
								</button>
							)}
						</div>

						{/* Create form */}
						{showVariantForm && (
							<div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
								<p className="mb-3 font-semibold text-foreground text-sm">
									New variant
								</p>
								<VariantForm
									initial={emptyVariantForm}
									onSubmit={handleCreateVariant}
									onCancel={() => setShowVariantForm(false)}
									submitting={createVariantMutation.isPending}
									submitLabel="Create variant"
								/>
							</div>
						)}

						{/* Edit form */}
						{editingVariant && (
							<div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
								<p className="mb-3 font-semibold text-foreground text-sm">
									Edit variant: {editingVariant.name}
								</p>
								<VariantForm
									initial={{
										name: editingVariant.name,
										sku: editingVariant.sku || "",
										price: String(editingVariant.price),
										inventory: String(editingVariant.inventory),
										options: Object.entries(editingVariant.options).map(
											([key, value]) => createOption(key, value),
										),
									}}
									onSubmit={handleUpdateVariant}
									onCancel={() => setEditingVariant(null)}
									submitting={updateVariantMutation.isPending}
									submitLabel="Save changes"
								/>
							</div>
						)}

						{product.variants.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-border border-b">
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Name
											</th>
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												SKU
											</th>
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Price
											</th>
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Inventory
											</th>
											<th
												scope="col"
												className="pb-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Options
											</th>
											<th
												scope="col"
												className="pb-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{product.variants.map((variant) => (
											<tr key={variant.id}>
												<td className="py-2.5 font-medium text-foreground">
													{variant.name}
												</td>
												<td className="py-2.5 font-mono text-muted-foreground">
													{variant.sku || "—"}
												</td>
												<td className="py-2.5 text-foreground">
													{formatPrice(variant.price)}
												</td>
												<td className="py-2.5 text-foreground">
													{variant.inventory}
												</td>
												<td className="py-2.5">
													<div className="flex flex-wrap gap-1">
														{Object.entries(variant.options).map(
															([key, value]) => (
																<span
																	key={rowKey}
																	className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs"
																>
																	{key}: {value}
																</span>
															),
														)}
													</div>
												</td>
												<td className="py-2.5 text-right">
													<div className="flex justify-end gap-1">
														<button
															type="button"
															onClick={() => {
																setShowVariantForm(false);
																setEditingVariant(variant);
															}}
															className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={() => handleDeleteVariant(variant.id)}
															disabled={deleteVariantMutation.isPending}
															className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
														>
															Delete
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							!showVariantForm && (
								<p className="text-center text-muted-foreground text-sm">
									No variants. Add variants to offer different sizes, colors, or
									options.
								</p>
							)
						)}
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-5">
					{/* Details */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Details
						</h2>
						<dl className="space-y-3">
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Price
								</dt>
								<dd className="mt-0.5 font-semibold text-foreground text-sm">
									{formatPrice(product.price)}
									{product.compareAtPrice != null &&
										product.compareAtPrice > product.price && (
											<span className="ml-2 font-normal text-muted-foreground line-through">
												{formatPrice(product.compareAtPrice)}
											</span>
										)}
								</dd>
							</div>
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Inventory
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{product.inventory} in stock
								</dd>
							</div>
							{product.category && (
								<div>
									<dt className="font-medium text-muted-foreground text-xs">
										Category
									</dt>
									<dd className="mt-0.5 text-foreground text-sm">
										{product.category.name}
									</dd>
								</div>
							)}
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Featured
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{product.isFeatured ? "Yes" : "No"}
								</dd>
							</div>
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Created
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{formatDate(product.createdAt)}
								</dd>
							</div>
							<div>
								<dt className="font-medium text-muted-foreground text-xs">
									Updated
								</dt>
								<dd className="mt-0.5 text-foreground text-sm">
									{formatDate(product.updatedAt)}
								</dd>
							</div>
						</dl>
					</div>

					{/* Tags */}
					{product.tags.length > 0 && (
						<div className="rounded-lg border border-border bg-card p-5">
							<h2 className="mb-4 font-semibold text-foreground text-sm">
								Tags
							</h2>
							<div className="flex flex-wrap gap-1.5">
								{product.tags.map((tag) => (
									<span
										key={tag}
										className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs"
									>
										{tag}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	return <ProductDetailTemplate content={content} />;
}
