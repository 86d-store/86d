"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import PagesAdminTemplate from "./pages-admin.mdx";

interface PageItem {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | null;
	status: "draft" | "published" | "archived";
	template?: string | null;
	metaTitle?: string | null;
	metaDescription?: string | null;
	featuredImage?: string | null;
	position: number;
	showInNavigation: boolean;
	parentId?: string | null;
	publishedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

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

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	published:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	archived: "bg-muted text-muted-foreground",
};

function usePagesAdminApi() {
	const client = useModuleClient();
	return {
		listPages: client.module("pages").admin["/admin/pages"],
		getPage: client.module("pages").admin["/admin/pages/:id"],
		createPage: client.module("pages").admin["/admin/pages/create"],
		updatePage: client.module("pages").admin["/admin/pages/:id/update"],
		deletePage: client.module("pages").admin["/admin/pages/:id/delete"],
	};
}

function DeleteModal({
	page,
	onClose,
	onSuccess,
}: {
	page: PageItem;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = usePagesAdminApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.deletePage.useMutation({
		onSuccess: () => {
			void api.listPages.invalidate();
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
						Delete page?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{page.title}</span>{" "}
						will be permanently deleted.
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
							onClick={() => deleteMutation.mutate({ params: { id: page.id } })}
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

function PageForm({
	page,
	onSaved,
	onCancel,
}: {
	page?: PageItem | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = usePagesAdminApi();
	const isEditing = !!page;

	const [title, setTitle] = useState(page?.title ?? "");
	const [slug, setSlug] = useState(page?.slug ?? "");
	const [content, setContent] = useState(page?.content ?? "");
	const [excerpt, setExcerpt] = useState(page?.excerpt ?? "");
	const [metaTitle, setMetaTitle] = useState(page?.metaTitle ?? "");
	const [metaDescription, setMetaDescription] = useState(
		page?.metaDescription ?? "",
	);
	const [featuredImage, setFeaturedImage] = useState(page?.featuredImage ?? "");
	const [position, setPosition] = useState(String(page?.position ?? 0));
	const [showInNavigation, setShowInNavigation] = useState(
		page?.showInNavigation ?? false,
	);
	const [status, setStatus] = useState<"draft" | "published">(
		page?.status === "published" ? "published" : "draft",
	);
	const [error, setError] = useState("");

	const createMutation = api.createPage.useMutation({
		onSuccess: () => {
			void api.listPages.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to create page."),
	});

	const updateMutation = api.updatePage.useMutation({
		onSuccess: () => {
			void api.listPages.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to update page."),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const payload = {
			title,
			...(slug.trim() ? { slug: slug.trim() } : {}),
			content,
			...(excerpt.trim() ? { excerpt: excerpt.trim() } : {}),
			...(metaTitle.trim() ? { metaTitle: metaTitle.trim() } : {}),
			...(metaDescription.trim()
				? { metaDescription: metaDescription.trim() }
				: {}),
			...(featuredImage.trim() ? { featuredImage: featuredImage.trim() } : {}),
			position: Number(position) || 0,
			showInNavigation,
			status,
		};

		if (isEditing && page) {
			updateMutation.mutate({ params: { id: page.id }, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Page" : "New Page"}
				</h2>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					Cancel
				</button>
			</div>

			<div>
				<label
					htmlFor="page-title"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Title <span className="text-destructive">*</span>
				</label>
				<input
					id="page-title"
					type="text"
					required
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="About Us"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="page-slug"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Slug
				</label>
				<input
					id="page-slug"
					type="text"
					value={slug}
					onChange={(e) => setSlug(e.target.value)}
					placeholder="about-us (auto-generated if blank)"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="page-excerpt"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Excerpt
				</label>
				<textarea
					id="page-excerpt"
					value={excerpt}
					onChange={(e) => setExcerpt(e.target.value)}
					placeholder="A brief summary of the page..."
					rows={2}
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="page-content"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Content <span className="text-destructive">*</span>
				</label>
				<textarea
					id="page-content"
					required
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your page content here..."
					rows={12}
					className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label
						htmlFor="page-meta-title"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Meta Title
					</label>
					<input
						id="page-meta-title"
						type="text"
						value={metaTitle}
						onChange={(e) => setMetaTitle(e.target.value)}
						placeholder="SEO title"
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
					/>
				</div>
				<div>
					<label
						htmlFor="page-position"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Position
					</label>
					<input
						id="page-position"
						type="number"
						min="0"
						value={position}
						onChange={(e) => setPosition(e.target.value)}
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
					/>
				</div>
			</div>

			<div>
				<label
					htmlFor="page-meta-desc"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Meta Description
				</label>
				<textarea
					id="page-meta-desc"
					value={metaDescription}
					onChange={(e) => setMetaDescription(e.target.value)}
					placeholder="SEO description"
					rows={2}
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="page-featured-image"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Featured Image URL
				</label>
				<input
					id="page-featured-image"
					type="url"
					value={featuredImage}
					onChange={(e) => setFeaturedImage(e.target.value)}
					placeholder="https://example.com/image.jpg"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label
						htmlFor="page-status"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Status
					</label>
					<select
						id="page-status"
						value={status}
						onChange={(e) => setStatus(e.target.value as "draft" | "published")}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="draft">Draft</option>
						<option value="published">Published</option>
					</select>
				</div>
				<div className="flex items-end pb-1">
					<label className="flex items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={showInNavigation}
							onChange={(e) => setShowInNavigation(e.target.checked)}
							className="h-4 w-4 rounded border-border"
						/>
						Show in navigation
					</label>
				</div>
			</div>

			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
				>
					{isPending
						? "Saving\u2026"
						: isEditing
							? "Update Page"
							: "Create Page"}
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

export function PagesAdmin() {
	const api = usePagesAdminApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<PageItem | null>(null);
	const [editTarget, setEditTarget] = useState<PageItem | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const pageSize = 25;

	useEffect(() => {
		if (!deleteTarget) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setDeleteTarget(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [deleteTarget]);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: pagesError,
		refetch: refetchPages,
	} = api.listPages.useQuery(queryInput) as {
		data: { pages: PageItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (pagesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load pages</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPages()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const pages = data?.pages ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	if (showCreateForm || editTarget) {
		return (
			<PageForm
				page={editTarget ?? undefined}
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

	const subtitle = `${total} ${total === 1 ? "page" : "pages"}`;

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 6 }).map((_, j) => (
					<td key={`skeleton-cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : pages.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No pages found</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create your first content page to get started.
				</p>
			</td>
		</tr>
	) : (
		pages.map((p) => (
			<tr key={p.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<div>
						<span className="font-medium text-foreground text-sm">
							{p.title}
						</span>
						<p className="text-muted-foreground text-xs">/p/{p.slug}</p>
					</div>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{p.status}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-foreground text-sm md:table-cell">
					{p.showInNavigation ? (
						<span className="text-green-600 dark:text-green-400">Yes</span>
					) : (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-foreground text-sm lg:table-cell">
					{p.position}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs xl:table-cell">
					{timeAgo(p.updatedAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setEditTarget(p)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(p)}
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
		<PagesAdminTemplate
			subtitle={subtitle}
			onNewPage={() => setShowCreateForm(true)}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			deleteModal={
				deleteTarget ? (
					<DeleteModal
						page={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={() => setDeleteTarget(null)}
					/>
				) : null
			}
		/>
	);
}
