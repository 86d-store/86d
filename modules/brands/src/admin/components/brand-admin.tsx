"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { isSafeUrl } from "@86d-app/core/sanitize";
import { useEffect, useRef, useState } from "react";

function useBrandsAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("brands").admin["/admin/brands"],
		stats: client.module("brands").admin["/admin/brands/stats"],
		create: client.module("brands").admin["/admin/brands/create"],
		get: client.module("brands").admin["/admin/brands/:id"],
		update: client.module("brands").admin["/admin/brands/:id/update"],
		deleteBrand: client.module("brands").admin["/admin/brands/:id/delete"],
	};
}

interface BrandData {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	logo?: string | null;
	bannerImage?: string | null;
	website?: string | null;
	isActive: boolean;
	isFeatured: boolean;
	position: number;
	seoTitle?: string | null;
	seoDescription?: string | null;
	productCount?: number;
	createdAt: string;
	updatedAt: string;
}

const PAGE_SIZE = 20;

interface StatsData {
	totalBrands: number;
	activeBrands: number;
	featuredBrands: number;
	totalProducts: number;
}

function BrandForm({
	brand,
	onSaved,
	onCancel,
}: {
	brand?: BrandData | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useBrandsAdminApi();
	const isEditing = !!brand;

	const [name, setName] = useState(brand?.name ?? "");
	const [slug, setSlug] = useState(brand?.slug ?? "");
	const [slugDirty, setSlugDirty] = useState(isEditing);
	const [description, setDescription] = useState(brand?.description ?? "");
	const [logo, setLogo] = useState(brand?.logo ?? "");
	const [bannerImage, setBannerImage] = useState(brand?.bannerImage ?? "");
	const [website, setWebsite] = useState(brand?.website ?? "");
	const [isActive, setIsActive] = useState(brand?.isActive ?? true);
	const [isFeatured, setIsFeatured] = useState(brand?.isFeatured ?? false);
	const [position, setPosition] = useState(String(brand?.position ?? 0));
	const [seoTitle, setSeoTitle] = useState(brand?.seoTitle ?? "");
	const [seoDescription, setSeoDescription] = useState(
		brand?.seoDescription ?? "",
	);
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(err.message ?? "Failed to create"),
	});

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(err.message ?? "Failed to update"),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleNameChange = (value: string) => {
		setName(value);
		if (!slugDirty) {
			setSlug(slugify(value));
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		if (!slug.trim()) {
			setError("Slug is required.");
			return;
		}

		const payload: Record<string, unknown> = {
			name: name.trim(),
			slug: slug.trim(),
			isActive,
			isFeatured,
			position: Number(position) || 0,
		};

		if (description.trim()) payload.description = description.trim();
		else if (isEditing) payload.description = null;

		if (logo.trim()) payload.logo = logo.trim();
		else if (isEditing) payload.logo = null;

		if (bannerImage.trim()) payload.bannerImage = bannerImage.trim();
		else if (isEditing) payload.bannerImage = null;

		if (website.trim()) payload.website = website.trim();
		else if (isEditing) payload.website = null;

		if (seoTitle.trim()) payload.seoTitle = seoTitle.trim();
		else if (isEditing) payload.seoTitle = null;

		if (seoDescription.trim()) payload.seoDescription = seoDescription.trim();
		else if (isEditing) payload.seoDescription = null;

		if (isEditing && brand) {
			updateMutation.mutate({
				params: { id: brand.id },
				...payload,
			});
		} else {
			createMutation.mutate(payload);
		}
	};

	const inputCls =
		"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1";
	const labelCls = "mb-1 block font-medium text-foreground text-sm";

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Brand" : "New Brand"}
				</h2>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					Cancel
				</button>
			</div>

			{/* Name + Slug */}
			<div>
				<label htmlFor="brand-name" className={labelCls}>
					Name <span className="text-destructive">*</span>
				</label>
				<input
					id="brand-name"
					type="text"
					required
					value={name}
					onChange={(e) => handleNameChange(e.target.value)}
					placeholder="Artisan Co."
					className={inputCls}
				/>
			</div>

			<div>
				<label htmlFor="brand-slug" className={labelCls}>
					Slug <span className="text-destructive">*</span>
				</label>
				<input
					id="brand-slug"
					type="text"
					required
					value={slug}
					onChange={(e) => {
						setSlug(e.target.value);
						setSlugDirty(true);
					}}
					placeholder="artisan-co"
					className={inputCls}
				/>
			</div>

			{/* Description */}
			<div>
				<label htmlFor="brand-desc" className={labelCls}>
					Description
				</label>
				<textarea
					id="brand-desc"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="A brief description of this brand..."
					rows={3}
					className={inputCls}
				/>
			</div>

			{/* Logo + Banner */}
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="brand-logo" className={labelCls}>
						Logo URL
					</label>
					<input
						id="brand-logo"
						type="url"
						value={logo}
						onChange={(e) => setLogo(e.target.value)}
						placeholder="https://example.com/logo.png"
						className={inputCls}
					/>
					{logo.trim() && isSafeUrl(logo) && (
						<img
							src={logo}
							alt="Logo preview"
							className="mt-2 h-10 w-auto rounded object-contain"
						/>
					)}
				</div>
				<div>
					<label htmlFor="brand-banner" className={labelCls}>
						Banner Image URL
					</label>
					<input
						id="brand-banner"
						type="url"
						value={bannerImage}
						onChange={(e) => setBannerImage(e.target.value)}
						placeholder="https://example.com/banner.jpg"
						className={inputCls}
					/>
				</div>
			</div>

			{/* Website */}
			<div>
				<label htmlFor="brand-website" className={labelCls}>
					Website
				</label>
				<input
					id="brand-website"
					type="url"
					value={website}
					onChange={(e) => setWebsite(e.target.value)}
					placeholder="https://artisanco.com"
					className={inputCls}
				/>
			</div>

			{/* Active / Featured / Position */}
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="flex items-end pb-1">
					<label className="flex items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={isActive}
							onChange={(e) => setIsActive(e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						Active
					</label>
				</div>
				<div className="flex items-end pb-1">
					<label className="flex items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={isFeatured}
							onChange={(e) => setIsFeatured(e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						Featured
					</label>
				</div>
				<div>
					<label htmlFor="brand-position" className={labelCls}>
						Position
					</label>
					<input
						id="brand-position"
						type="number"
						min="0"
						max="10000"
						value={position}
						onChange={(e) => setPosition(e.target.value)}
						className={inputCls}
					/>
				</div>
			</div>

			{/* SEO */}
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="brand-seo-title" className={labelCls}>
						SEO Title
					</label>
					<input
						id="brand-seo-title"
						type="text"
						value={seoTitle}
						onChange={(e) => setSeoTitle(e.target.value)}
						placeholder="SEO title override"
						className={inputCls}
					/>
				</div>
				<div>
					<label htmlFor="brand-seo-desc" className={labelCls}>
						SEO Description
					</label>
					<input
						id="brand-seo-desc"
						type="text"
						value={seoDescription}
						onChange={(e) => setSeoDescription(e.target.value)}
						placeholder="SEO description override"
						className={inputCls}
					/>
				</div>
			</div>

			{/* Error */}
			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			{/* Actions */}
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
				>
					{isPending
						? "Saving\u2026"
						: isEditing
							? "Update Brand"
							: "Create Brand"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-5 py-2 font-medium text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function DeleteModal({
	brand,
	onClose,
	onSuccess,
}: {
	brand: BrandData;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const api = useBrandsAdminApi();

	const deleteMutation = api.deleteBrand.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
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
						Delete brand?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{brand.name}</span>{" "}
						and all its product associations will be permanently deleted.
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
								deleteMutation.mutate({ params: { id: brand.id } })
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

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function BrandAdmin() {
	const api = useBrandsAdminApi();
	const [skip, setSkip] = useState(0);
	const [activeFilter, setActiveFilter] = useState("");
	const [featuredFilter, setFeaturedFilter] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<BrandData | null>(null);
	const [editTarget, setEditTarget] = useState<BrandData | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (activeFilter) queryInput.active = activeFilter;
	if (featuredFilter) queryInput.featured = featuredFilter;

	const {
		data: listData,
		isLoading: listLoading,
		isError: brandsError,
		refetch: refetchBrands,
	} = api.list.useQuery(queryInput) as {
		data: { brands: BrandData[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: StatsData } | undefined;
	};

	const brands = listData?.brands ?? [];
	const total = listData?.total ?? 0;
	const stats = statsData?.stats;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

	if (brandsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load brands</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchBrands()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	// ── Form views
	if (showCreateForm || editTarget) {
		return (
			<BrandForm
				brand={editTarget ?? undefined}
				onSaved={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
				onCancel={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
			/>
		);
	}

	// ── Stats
	const statsRow = stats ? (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{[
				{ label: "Total", value: stats.totalBrands },
				{ label: "Active", value: stats.activeBrands },
				{ label: "Featured", value: stats.featuredBrands },
				{ label: "Products", value: stats.totalProducts },
			].map(({ label, value }) => (
				<div key={label} className="rounded-lg border border-border p-3">
					<div className="font-bold text-foreground text-xl tabular-nums">
						{value}
					</div>
					<div className="text-muted-foreground text-xs">{label}</div>
				</div>
			))}
		</div>
	) : null;

	// ── Table body
	const tableBody = listLoading ? (
		Array.from({ length: 5 }, (_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 5 }, (_, j) => (
					<td key={`cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : brands.length === 0 ? (
		<tr>
			<td colSpan={5} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No brands found</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create your first brand to organize products by manufacturer.
				</p>
			</td>
		</tr>
	) : (
		brands.map((brand) => (
			<tr key={brand.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<div className="flex items-center gap-3">
						{brand.logo ? (
							<img
								src={brand.logo}
								alt={brand.name}
								className="size-8 rounded object-contain"
							/>
						) : (
							<div className="flex size-8 items-center justify-center rounded bg-muted font-medium text-muted-foreground text-xs">
								{brand.name[0]}
							</div>
						)}
						<div>
							<span className="font-medium text-foreground text-sm">
								{brand.name}
							</span>
							<p className="text-muted-foreground text-xs">/{brand.slug}</p>
						</div>
					</div>
				</td>
				<td className="px-4 py-3">
					<span
						className={
							brand.isActive
								? "text-green-600 dark:text-green-400"
								: "text-muted-foreground"
						}
					>
						{brand.isActive ? "Active" : "Inactive"}
					</span>
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{brand.isFeatured ? (
						<span className="text-amber-600 dark:text-amber-400">Featured</span>
					) : (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="px-4 py-3 text-muted-foreground text-sm tabular-nums">
					{brand.productCount ?? 0}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setEditTarget(brand)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(brand)}
							className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-foreground text-xl">Brands</h1>
					<p className="text-muted-foreground text-sm">
						{total} {total === 1 ? "brand" : "brands"}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreateForm(true)}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
				>
					New brand
				</button>
			</div>

			{/* Stats */}
			{statsRow}

			{/* Filters */}
			<div className="flex flex-wrap gap-2">
				<select
					value={activeFilter}
					onChange={(e) => {
						setActiveFilter(e.target.value);
						setSkip(0);
					}}
					className="h-8 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="Filter by status"
				>
					<option value="">All statuses</option>
					<option value="true">Active</option>
					<option value="false">Inactive</option>
				</select>
				<select
					value={featuredFilter}
					onChange={(e) => {
						setFeaturedFilter(e.target.value);
						setSkip(0);
					}}
					className="h-8 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="Filter by featured"
				>
					<option value="">All brands</option>
					<option value="true">Featured</option>
					<option value="false">Not featured</option>
				</select>
			</div>

			{/* Table */}
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/30 text-left">
							<th
								scope="col"
								className="px-4 py-2.5 font-medium text-muted-foreground"
							>
								Brand
							</th>
							<th
								scope="col"
								className="px-4 py-2.5 font-medium text-muted-foreground"
							>
								Status
							</th>
							<th
								scope="col"
								className="hidden px-4 py-2.5 font-medium text-muted-foreground md:table-cell"
							>
								Featured
							</th>
							<th
								scope="col"
								className="px-4 py-2.5 font-medium text-muted-foreground"
							>
								Products
							</th>
							<th
								scope="col"
								className="px-4 py-2.5 text-right font-medium text-muted-foreground"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">{tableBody}</tbody>
				</table>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center gap-4">
					<button
						type="button"
						disabled={currentPage <= 1}
						onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
						className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-muted-foreground text-sm">
						Page {currentPage} of {totalPages}
					</span>
					<button
						type="button"
						disabled={currentPage >= totalPages}
						onClick={() => setSkip(skip + PAGE_SIZE)}
						className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
					>
						Next
					</button>
				</div>
			)}

			{/* Delete modal */}
			{deleteTarget && (
				<DeleteModal
					brand={deleteTarget}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
}
