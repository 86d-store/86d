"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	createProductFormDefaults,
	createProductFormSchema,
	formValuesToCreateBody,
} from "../form/create-product-schema";

interface Category {
	id: string;
	name: string;
}

interface CategoriesResult {
	categories: Category[];
}

interface ProductCreateFormProps {
	onNavigate: (path: string) => void;
}

function slugify(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

/**
 * Locked reference form for /admin/products/new — TanStack Form + shared Zod schema.
 */
export function ProductCreateForm({ onNavigate }: ProductCreateFormProps) {
	const client = useModuleClient();
	const createProduct =
		client.module("products").admin["/admin/products/create"];
	const listProducts = client.module("products").admin["/admin/products/list"];
	const listCategories =
		client.module("products").admin["/admin/categories/list"];
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [slugEdited, setSlugEdited] = useState(false);

	const { data: categoriesData } = listCategories.useQuery({
		limit: "100",
	}) as { data: CategoriesResult | undefined };

	const categories = categoriesData?.categories ?? [];

	const createMutation = createProduct.useMutation({
		onSuccess: () => {
			void listProducts.invalidate();
			onNavigate("/admin/products");
		},
		onError: (err: Error) => {
			setSubmitError(extractError(err, "Failed to save product"));
		},
	});

	const form = useForm({
		defaultValues: createProductFormDefaults,
		validators: {
			onSubmit: createProductFormSchema,
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const body = formValuesToCreateBody(value);
			await createMutation.mutateAsync(body);
		},
	});

	return (
		<form
			id="create-product-form"
			data-testid="create-product-form"
			className="space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				setSubmitError(null);
				void form.handleSubmit();
			}}
		>
			{submitError ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
				>
					{submitError}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-5 lg:col-span-2">
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Product details
						</h2>
						<div className="space-y-4">
							<form.Field name="name">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Name <span className="text-destructive">*</span>
										</label>
										<input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(event) => {
												const next = event.target.value;
												field.handleChange(next);
												if (!slugEdited) {
													form.setFieldValue("slug", slugify(next));
												}
											}}
											placeholder="Product name"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										{field.state.meta.errors[0] ? (
											<p className="mt-1 text-destructive text-xs">
												{String(
													(field.state.meta.errors[0] as { message?: string })
														.message ?? field.state.meta.errors[0],
												)}
											</p>
										) : null}
									</div>
								)}
							</form.Field>

							<form.Field name="slug">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Slug <span className="text-destructive">*</span>
										</label>
										<input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(event) => {
												setSlugEdited(true);
												field.handleChange(event.target.value);
											}}
											placeholder="product-slug"
											className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										{field.state.meta.errors[0] ? (
											<p className="mt-1 text-destructive text-xs">
												{String(
													(field.state.meta.errors[0] as { message?: string })
														.message ?? field.state.meta.errors[0],
												)}
											</p>
										) : null}
									</div>
								)}
							</form.Field>

							<form.Field name="shortDescription">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Short description
										</label>
										<input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="Brief product description"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="description">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Description
										</label>
										<textarea
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="Full product description"
											rows={5}
											className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								)}
							</form.Field>
						</div>
					</div>

					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Pricing
						</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<form.Field name="price">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Price (USD) <span className="text-destructive">*</span>
										</label>
										<input
											id={field.name}
											name={field.name}
											type="number"
											min="0"
											step="0.01"
											value={field.state.value}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="0.00"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										{field.state.meta.errors[0] ? (
											<p className="mt-1 text-destructive text-xs">
												{String(
													(field.state.meta.errors[0] as { message?: string })
														.message ?? field.state.meta.errors[0],
												)}
											</p>
										) : null}
									</div>
								)}
							</form.Field>

							<form.Field name="compareAtPrice">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Compare-at price
										</label>
										<input
											id={field.name}
											name={field.name}
											type="number"
											min="0"
											step="0.01"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="0.00"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								)}
							</form.Field>
						</div>
					</div>
				</div>

				<div className="space-y-5">
					<form.Field name="status">
						{(field) => (
							<div className="rounded-lg border border-border bg-card p-5">
								<h2 className="mb-4 font-semibold text-foreground text-sm">
									Status
								</h2>
								<select
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) =>
										field.handleChange(
											event.target.value as "draft" | "active" | "archived",
										)
									}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="draft">Draft</option>
									<option value="active">Active</option>
									<option value="archived">Archived</option>
								</select>
							</div>
						)}
					</form.Field>

					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-4 font-semibold text-foreground text-sm">
							Organization
						</h2>
						<div className="space-y-4">
							<form.Field name="categoryId">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Category
										</label>
										<select
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										>
											<option value="">No category</option>
											{categories.map((category) => (
												<option key={category.id} value={category.id}>
													{category.name}
												</option>
											))}
										</select>
									</div>
								)}
							</form.Field>

							<form.Field name="sku">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											SKU
										</label>
										<input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="SKU-001"
											className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="tags">
								{(field) => (
									<div>
										<label
											htmlFor={field.name}
											className="mb-1.5 block font-medium text-foreground text-sm"
										>
											Tags
										</label>
										<input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="tag1, tag2, tag3"
											className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="isFeatured">
								{(field) => (
									<label className="flex items-center gap-2.5">
										<input
											type="checkbox"
											name={field.name}
											checked={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.checked)
											}
											className="h-4 w-4 rounded border-border"
										/>
										<span className="text-foreground text-sm">
											Featured product
										</span>
									</label>
								)}
							</form.Field>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<button
									type="submit"
									disabled={isSubmitting || createMutation.isPending}
									className="w-full rounded-md bg-foreground px-4 py-2.5 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
								>
									{isSubmitting || createMutation.isPending
										? "Saving…"
										: "Create product"}
								</button>
							)}
						</form.Subscribe>
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
