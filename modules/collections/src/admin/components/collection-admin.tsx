"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

// ─── Types ──────────────────────────────────────────────────────────

interface CollectionData {
	id: string;
	title: string;
	slug: string;
	description?: string | null;
	image?: string | null;
	type: string;
	sortOrder: string;
	isActive: boolean;
	isFeatured: boolean;
	position: number;
	seoTitle?: string | null;
	seoDescription?: string | null;
	conditions?: { match: string; rules: ConditionRule[] } | null;
	createdAt: string;
	updatedAt: string;
}

interface ConditionRule {
	field: string;
	operator: string;
	value: string | number | string[];
}

interface StatsData {
	totalCollections: number;
	activeCollections: number;
	featuredCollections: number;
	manualCollections: number;
	automaticCollections: number;
	totalProducts: number;
}

type CollectionType = "manual" | "automatic";

type SortOrder =
	| "manual"
	| "title-asc"
	| "title-desc"
	| "price-asc"
	| "price-desc"
	| "created-asc"
	| "created-desc"
	| "best-selling";

// ─── Helpers ────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

const SORT_ORDER_LABELS: Record<SortOrder, string> = {
	manual: "Manual",
	"title-asc": "Title A\u2013Z",
	"title-desc": "Title Z\u2013A",
	"price-asc": "Price (low to high)",
	"price-desc": "Price (high to low)",
	"created-asc": "Oldest first",
	"created-desc": "Newest first",
	"best-selling": "Best selling",
};

// ─── API hook ───────────────────────────────────────────────────────

function useCollectionAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("collections").admin["/admin/collections"],
		stats: client.module("collections").admin["/admin/collections/stats"],
		create: client.module("collections").admin["/admin/collections/create"],
		update: client.module("collections").admin["/admin/collections/:id/update"],
		deleteCollection:
			client.module("collections").admin["/admin/collections/:id/delete"],
	};
}

// ─── Delete modal ───────────────────────────────────────────────────

function DeleteModal({
	collection,
	onClose,
	onSuccess,
}: {
	collection: CollectionData;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useCollectionAdminApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.deleteCollection.useMutation({
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
						Delete collection?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">
							{collection.title}
						</span>{" "}
						and all its product links will be permanently deleted.
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
								deleteMutation.mutate({ params: { id: collection.id } })
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

// ─── Collection form ────────────────────────────────────────────────

function CollectionForm({
	collection,
	onSaved,
	onCancel,
}: {
	collection?: CollectionData | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useCollectionAdminApi();
	const isEditing = !!collection;

	const [title, setTitle] = useState(collection?.title ?? "");
	const [slug, setSlug] = useState(collection?.slug ?? "");
	const [slugDirty, setSlugDirty] = useState(isEditing);
	const [description, setDescription] = useState(collection?.description ?? "");
	const [image, setImage] = useState(collection?.image ?? "");
	const [type, setType] = useState<CollectionType>(
		(collection?.type as CollectionType) ?? "manual",
	);
	const [sortOrder, setSortOrder] = useState<SortOrder>(
		(collection?.sortOrder as SortOrder) ?? "manual",
	);
	const [isActive, setIsActive] = useState(collection?.isActive ?? true);
	const [isFeatured, setIsFeatured] = useState(collection?.isFeatured ?? false);
	const [position, setPosition] = useState(String(collection?.position ?? 0));
	const [seoTitle, setSeoTitle] = useState(collection?.seoTitle ?? "");
	const [seoDescription, setSeoDescription] = useState(
		collection?.seoDescription ?? "",
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

	const handleTitleChange = (value: string) => {
		setTitle(value);
		if (!slugDirty) {
			setSlug(slugify(value));
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!title.trim()) {
			setError("Title is required.");
			return;
		}
		if (!slug.trim()) {
			setError("Slug is required.");
			return;
		}

		const payload: Record<string, unknown> = {
			title: title.trim(),
			slug: slug.trim(),
			type,
			sortOrder,
			isActive,
			isFeatured,
			position: Number(position) || 0,
		};

		if (description.trim()) payload.description = description.trim();
		else if (isEditing) payload.description = null;

		if (image.trim()) payload.image = image.trim();
		else if (isEditing) payload.image = null;

		if (seoTitle.trim()) payload.seoTitle = seoTitle.trim();
		else if (isEditing) payload.seoTitle = null;

		if (seoDescription.trim()) payload.seoDescription = seoDescription.trim();
		else if (isEditing) payload.seoDescription = null;

		if (isEditing && collection) {
			updateMutation.mutate({
				params: { id: collection.id },
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
					{isEditing ? "Edit Collection" : "New Collection"}
				</h2>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					Cancel
				</button>
			</div>

			{/* Title + Slug */}
			<div>
				<label htmlFor="coll-title" className={labelCls}>
					Title <span className="text-destructive">*</span>
				</label>
				<input
					id="coll-title"
					type="text"
					required
					value={title}
					onChange={(e) => handleTitleChange(e.target.value)}
					placeholder="Summer Sale"
					className={inputCls}
				/>
			</div>

			<div>
				<label htmlFor="coll-slug" className={labelCls}>
					Slug <span className="text-destructive">*</span>
				</label>
				<input
					id="coll-slug"
					type="text"
					required
					value={slug}
					onChange={(e) => {
						setSlug(e.target.value);
						setSlugDirty(true);
					}}
					placeholder="summer-sale"
					className={inputCls}
				/>
			</div>

			{/* Description */}
			<div>
				<label htmlFor="coll-desc" className={labelCls}>
					Description
				</label>
				<textarea
					id="coll-desc"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="A brief description of this collection..."
					rows={3}
					className={inputCls}
				/>
			</div>

			{/* Image */}
			<div>
				<label htmlFor="coll-image" className={labelCls}>
					Image URL
				</label>
				<input
					id="coll-image"
					type="url"
					value={image}
					onChange={(e) => setImage(e.target.value)}
					placeholder="https://example.com/image.jpg"
					className={inputCls}
				/>
			</div>

			{/* Type + Sort Order */}
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="coll-type" className={labelCls}>
						Type
					</label>
					<select
						id="coll-type"
						value={type}
						onChange={(e) => setType(e.target.value as CollectionType)}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="manual">Manual</option>
						<option value="automatic">Automatic</option>
					</select>
				</div>
				<div>
					<label htmlFor="coll-sort" className={labelCls}>
						Sort Order
					</label>
					<select
						id="coll-sort"
						value={sortOrder}
						onChange={(e) => setSortOrder(e.target.value as SortOrder)}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{Object.entries(SORT_ORDER_LABELS).map(([val, label]) => (
							<option key={val} value={val}>
								{label}
							</option>
						))}
					</select>
				</div>
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
					<label htmlFor="coll-position" className={labelCls}>
						Position
					</label>
					<input
						id="coll-position"
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
					<label htmlFor="coll-seo-title" className={labelCls}>
						SEO Title
					</label>
					<input
						id="coll-seo-title"
						type="text"
						value={seoTitle}
						onChange={(e) => setSeoTitle(e.target.value)}
						placeholder="SEO title override"
						className={inputCls}
					/>
				</div>
				<div>
					<label htmlFor="coll-seo-desc" className={labelCls}>
						SEO Description
					</label>
					<input
						id="coll-seo-desc"
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
							? "Update Collection"
							: "Create Collection"}
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

// ─── Main component ─────────────────────────────────────────────────

export function CollectionAdmin() {
	const api = useCollectionAdminApi();
	const [skip, setSkip] = useState(0);
	const [typeFilter, setTypeFilter] = useState("");
	const [activeFilter, setActiveFilter] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<CollectionData | null>(null);
	const [editTarget, setEditTarget] = useState<CollectionData | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);

	useEffect(() => {
		if (!deleteTarget) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setDeleteTarget(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [deleteTarget]);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (typeFilter) queryInput.type = typeFilter;
	if (activeFilter) queryInput.isActive = activeFilter;

	const {
		data: listData,
		isLoading: listLoading,
		isError: collectionsError,
		refetch: refetchCollections,
	} = api.list.useQuery(queryInput) as {
		data: { collections: CollectionData[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: StatsData } | undefined;
	};

	if (collectionsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load collections
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCollections()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const collections = listData?.collections ?? [];
	const total = listData?.total ?? 0;
	const stats = statsData?.stats;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

	// ── Form views
	if (showCreateForm || editTarget) {
		return (
			<CollectionForm
				collection={editTarget ?? undefined}
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
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			{[
				{ label: "Total", value: stats.totalCollections },
				{ label: "Active", value: stats.activeCollections },
				{ label: "Featured", value: stats.featuredCollections },
				{ label: "Manual", value: stats.manualCollections },
				{ label: "Automatic", value: stats.automaticCollections },
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
				{Array.from({ length: 6 }, (_, j) => (
					<td key={`cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : collections.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No collections found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create your first collection to organize products.
				</p>
			</td>
		</tr>
	) : (
		collections.map((c) => (
			<tr key={c.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<div>
						<span className="font-medium text-foreground text-sm">
							{c.title}
						</span>
						<p className="text-muted-foreground text-xs">/{c.slug}</p>
					</div>
				</td>
				<td className="px-4 py-3">
					<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs capitalize">
						{c.type}
					</span>
				</td>
				<td className="px-4 py-3">
					<span
						className={
							c.isActive
								? "text-green-600 dark:text-green-400"
								: "text-muted-foreground"
						}
					>
						{c.isActive ? "Active" : "Draft"}
					</span>
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{c.isFeatured ? (
						<span className="text-amber-600 dark:text-amber-400">Featured</span>
					) : (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs xl:table-cell">
					{timeAgo(c.updatedAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setEditTarget(c)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(c)}
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
					<h1 className="font-bold text-foreground text-xl">Collections</h1>
					<p className="text-muted-foreground text-sm">
						{total} {total === 1 ? "collection" : "collections"}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreateForm(true)}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
				>
					New collection
				</button>
			</div>

			{/* Stats */}
			{statsRow}

			{/* Filters */}
			<div className="flex flex-wrap gap-2">
				<select
					value={typeFilter}
					onChange={(e) => {
						setTypeFilter(e.target.value);
						setSkip(0);
					}}
					className="h-8 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="Filter by type"
				>
					<option value="">All types</option>
					<option value="manual">Manual</option>
					<option value="automatic">Automatic</option>
				</select>
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
					<option value="false">Draft</option>
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
								Title
							</th>
							<th
								scope="col"
								className="px-4 py-2.5 font-medium text-muted-foreground"
							>
								Type
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
								className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground xl:table-cell"
							>
								Updated
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
					collection={deleteTarget}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
}
