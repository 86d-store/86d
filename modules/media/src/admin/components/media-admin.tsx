"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import MediaAdminTemplate from "./media-admin.mdx";

interface Asset {
	id: string;
	name: string;
	altText?: string | null;
	url: string;
	mimeType: string;
	size: number;
	width?: number | null;
	height?: number | null;
	folder?: string | null;
	tags: string[];
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface Folder {
	id: string;
	name: string;
	parentId?: string | null;
	createdAt: string;
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

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const val = bytes / 1024 ** i;
	return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function mimeLabel(mime: string): string {
	if (mime.startsWith("image/"))
		return mime.replace("image/", "").toUpperCase();
	if (mime.startsWith("video/"))
		return mime.replace("video/", "").toUpperCase();
	if (mime === "application/pdf") return "PDF";
	return mime.split("/").pop()?.toUpperCase() ?? mime;
}

function useMediaAdminApi() {
	const client = useModuleClient();
	return {
		listAssets: client.module("media").admin["/admin/media"],
		getAsset: client.module("media").admin["/admin/media/:id"],
		createAsset: client.module("media").admin["/admin/media/create"],
		updateAsset: client.module("media").admin["/admin/media/:id/update"],
		deleteAsset: client.module("media").admin["/admin/media/:id/delete"],
		bulkDelete: client.module("media").admin["/admin/media/bulk-delete"],
		moveAssets: client.module("media").admin["/admin/media/move"],
		listFolders: client.module("media").admin["/admin/media/folders"],
		createFolder: client.module("media").admin["/admin/media/folders/create"],
		renameFolder: client.module("media").admin["/admin/media/folders/:id"],
		deleteFolder:
			client.module("media").admin["/admin/media/folders/:id/delete"],
	};
}

function DeleteModal({
	asset,
	onClose,
	onSuccess,
}: {
	asset: Asset;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useMediaAdminApi();

	const deleteMutation = api.deleteAsset.useMutation({
		onSuccess: () => {
			void api.listAssets.invalidate();
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
						Delete asset?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{asset.name}</span>{" "}
						will be permanently deleted.
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() =>
								deleteMutation.mutate({ params: { id: asset.id } })
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function AssetForm({
	asset,
	onSaved,
	onCancel,
}: {
	asset?: Asset | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useMediaAdminApi();
	const isEditing = !!asset;

	const [name, setName] = useState(asset?.name ?? "");
	const [url, setUrl] = useState(asset?.url ?? "");
	const [altText, setAltText] = useState(asset?.altText ?? "");
	const [mimeType, setMimeType] = useState(asset?.mimeType ?? "image/jpeg");
	const [size, setSize] = useState(String(asset?.size ?? 0));
	const [width, setWidth] = useState(asset?.width ? String(asset.width) : "");
	const [height, setHeight] = useState(
		asset?.height ? String(asset.height) : "",
	);
	const [tagsInput, setTagsInput] = useState(asset?.tags.join(", ") ?? "");
	const [error, setError] = useState("");

	const createMutation = api.createAsset.useMutation({
		onSuccess: () => {
			void api.listAssets.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to create asset."),
	});

	const updateMutation = api.updateAsset.useMutation({
		onSuccess: () => {
			void api.listAssets.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to update asset."),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

		if (isEditing && asset) {
			updateMutation.mutate({
				params: { id: asset.id },
				name,
				...(altText.trim() ? { altText: altText.trim() } : {}),
				...(url.trim() !== asset.url ? { url: url.trim() } : {}),
				tags,
			});
		} else {
			createMutation.mutate({
				name,
				url,
				mimeType,
				size: Number(size),
				...(altText.trim() ? { altText: altText.trim() } : {}),
				...(width ? { width: Number(width) } : {}),
				...(height ? { height: Number(height) } : {}),
				tags,
			});
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Asset" : "Add Asset"}
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
					htmlFor="asset-name"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Name <span className="text-destructive">*</span>
				</label>
				<input
					id="asset-name"
					type="text"
					required
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="hero-banner.jpg"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="asset-url"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					URL <span className="text-destructive">*</span>
				</label>
				<input
					id="asset-url"
					type="url"
					required
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://cdn.example.com/image.jpg"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="asset-alt"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Alt Text
				</label>
				<input
					id="asset-alt"
					type="text"
					value={altText}
					onChange={(e) => setAltText(e.target.value)}
					placeholder="Descriptive text for accessibility"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			{!isEditing && (
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label
							htmlFor="asset-mime"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							MIME Type <span className="text-destructive">*</span>
						</label>
						<select
							id="asset-mime"
							value={mimeType}
							onChange={(e) => setMimeType(e.target.value)}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="image/jpeg">image/jpeg</option>
							<option value="image/png">image/png</option>
							<option value="image/webp">image/webp</option>
							<option value="image/svg+xml">image/svg+xml</option>
							<option value="image/gif">image/gif</option>
							<option value="video/mp4">video/mp4</option>
							<option value="application/pdf">application/pdf</option>
						</select>
					</div>
					<div>
						<label
							htmlFor="asset-size"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Size (bytes) <span className="text-destructive">*</span>
						</label>
						<input
							id="asset-size"
							type="number"
							required
							min={0}
							value={size}
							onChange={(e) => setSize(e.target.value)}
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
						/>
					</div>
				</div>
			)}

			{!isEditing && (
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label
							htmlFor="asset-width"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Width (px)
						</label>
						<input
							id="asset-width"
							type="number"
							min={0}
							value={width}
							onChange={(e) => setWidth(e.target.value)}
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
						/>
					</div>
					<div>
						<label
							htmlFor="asset-height"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Height (px)
						</label>
						<input
							id="asset-height"
							type="number"
							min={0}
							value={height}
							onChange={(e) => setHeight(e.target.value)}
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
						/>
					</div>
				</div>
			)}

			<div>
				<label
					htmlFor="asset-tags"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Tags
				</label>
				<input
					id="asset-tags"
					type="text"
					value={tagsInput}
					onChange={(e) => setTagsInput(e.target.value)}
					placeholder="hero, banner, product"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
				<p className="mt-1 text-muted-foreground text-xs">
					Separate tags with commas
				</p>
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
					{isPending ? "Saving…" : isEditing ? "Update Asset" : "Add Asset"}
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

function NewFolderModal({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useMediaAdminApi();
	const folderNameRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		folderNameRef.current?.focus();
	}, []);
	const [name, setName] = useState("");

	const createMutation = api.createFolder.useMutation({
		onSuccess: () => {
			void api.listFolders.invalidate();
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
					<h2 className="font-semibold text-foreground text-lg">New Folder</h2>
					<input
						ref={folderNameRef}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Folder name"
						className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
					<div className="mt-5 flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => {
								if (name.trim()) createMutation.mutate({ name: name.trim() });
							}}
							disabled={!name.trim() || createMutation.isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating…" : "Create"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function MediaAdmin() {
	const api = useMediaAdminApi();
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
	const [editTarget, setEditTarget] = useState<Asset | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [showNewFolder, setShowNewFolder] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const pageSize = 50;

	const anyModalOpen = !!deleteTarget || showNewFolder;
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setDeleteTarget(null);
				setShowNewFolder(false);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (searchQuery.trim()) queryInput.search = searchQuery.trim();
	if (typeFilter) queryInput.mimeType = typeFilter;

	const {
		data,
		isLoading: loading,
		isError: assetsError,
		refetch: refetchAssets,
	} = api.listAssets.useQuery(queryInput) as {
		data: { assets: Asset[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: foldersData } = api.listFolders.useQuery({}) as {
		data: { folders: Folder[] } | undefined;
	};

	const assets = data?.assets ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const folders = foldersData?.folders ?? [];

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const allSelected =
		assets.length > 0 && assets.every((a) => selectedIds.has(a.id));

	const toggleSelectAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(assets.map((a) => a.id)));
		}
	};

	const bulkDeleteMutation = api.bulkDelete.useMutation({
		onSuccess: () => {
			void api.listAssets.invalidate();
			setSelectedIds(new Set());
		},
	});

	if (assetsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load media</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAssets()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	if (showCreateForm || editTarget) {
		return (
			<AssetForm
				asset={editTarget ?? undefined}
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

	const subtitle = `${total} ${total === 1 ? "asset" : "assets"}`;

	const foldersSection =
		folders.length > 0 ? (
			<div className="mb-4 flex flex-wrap gap-2">
				{folders.map((f) => (
					<span
						key={f.id}
						className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-foreground text-sm"
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
							<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
						</svg>
						{f.name}
					</span>
				))}
			</div>
		) : null;

	const tableBody = loading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
			<tr key={key}>
				{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map((key) => (
					<td key={key} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : assets.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No assets found</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Add your first media asset to get started.
				</p>
			</td>
		</tr>
	) : (
		assets.map((asset) => (
			<tr key={asset.id} className="transition-colors hover:bg-muted/30">
				<td className="w-10 px-4 py-3">
					<input
						type="checkbox"
						checked={selectedIds.has(asset.id)}
						onChange={() => toggleSelect(asset.id)}
						className="rounded border-border"
						aria-label={`Select ${asset.name}`}
					/>
				</td>
				<td className="px-4 py-3">
					<div className="flex items-center gap-3">
						{asset.mimeType.startsWith("image/") ? (
							<div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
								<Image
									src={asset.url}
									alt={asset.altText ?? asset.name}
									width={400}
									height={400}
									unoptimized
									className="h-full w-full object-cover"
								/>
							</div>
						) : (
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground text-xs">
								{mimeLabel(asset.mimeType).slice(0, 4)}
							</div>
						)}
						<div>
							<span className="font-medium text-foreground text-sm">
								{asset.name}
							</span>
							{asset.altText && (
								<p className="max-w-[200px] truncate text-muted-foreground text-xs">
									{asset.altText}
								</p>
							)}
						</div>
					</div>
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
						{mimeLabel(asset.mimeType)}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-right text-foreground text-sm lg:table-cell">
					{formatBytes(asset.size)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs xl:table-cell">
					{timeAgo(asset.createdAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setEditTarget(asset)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(asset)}
							className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	let modal: React.ReactNode = null;
	if (deleteTarget) {
		modal = (
			<DeleteModal
				asset={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onSuccess={() => setDeleteTarget(null)}
			/>
		);
	} else if (showNewFolder) {
		modal = (
			<NewFolderModal
				onClose={() => setShowNewFolder(false)}
				onSuccess={() => setShowNewFolder(false)}
			/>
		);
	}

	return (
		<MediaAdminTemplate
			subtitle={subtitle}
			selectedCount={selectedIds.size}
			onBulkDelete={() =>
				bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })
			}
			onNewFolder={() => setShowNewFolder(true)}
			onUpload={() => setShowCreateForm(true)}
			searchQuery={searchQuery}
			onSearchChange={(v: string) => {
				setSearchQuery(v);
				setPage(1);
			}}
			typeFilter={typeFilter}
			onTypeFilterChange={(v: string) => {
				setTypeFilter(v);
				setPage(1);
			}}
			breadcrumbs={null}
			foldersSection={foldersSection}
			allSelected={allSelected}
			onToggleSelectAll={toggleSelectAll}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			modal={modal}
		/>
	);
}
