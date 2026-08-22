"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import SeoAdminTemplate from "./seo-admin.mdx";

interface MetaTag {
	id: string;
	path: string;
	title?: string | null;
	description?: string | null;
	canonicalUrl?: string | null;
	ogTitle?: string | null;
	ogDescription?: string | null;
	ogImage?: string | null;
	noIndex: boolean;
	noFollow: boolean;
	updatedAt: string;
}

interface Redirect {
	id: string;
	fromPath: string;
	toPath: string;
	statusCode: number;
	active: boolean;
	updatedAt: string;
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useSeoAdminApi() {
	const client = useModuleClient();
	return {
		listMeta: client.module("seo").admin["/admin/seo/meta"],
		upsertMeta: client.module("seo").admin["/admin/seo/meta/upsert"],
		deleteMeta: client.module("seo").admin["/admin/seo/meta/:id/delete"],
		listRedirects: client.module("seo").admin["/admin/seo/redirects"],
		createRedirect: client.module("seo").admin["/admin/seo/redirects/create"],
		updateRedirect:
			client.module("seo").admin["/admin/seo/redirects/:id/update"],
		deleteRedirect:
			client.module("seo").admin["/admin/seo/redirects/:id/delete"],
	};
}

// ── Meta Tag Form ─────────────────────────────────────────────────────────

function MetaTagForm({
	initial,
	onSuccess,
	onCancel,
}: {
	initial?: MetaTag | null;
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const api = useSeoAdminApi();
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [path, setPath] = useState(initial?.path ?? "");
	const [title, setTitle] = useState(initial?.title ?? "");
	const [description, setDescription] = useState(initial?.description ?? "");
	const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl ?? "");
	const [ogTitle, setOgTitle] = useState(initial?.ogTitle ?? "");
	const [ogDescription, setOgDescription] = useState(
		initial?.ogDescription ?? "",
	);
	const [ogImage, setOgImage] = useState(initial?.ogImage ?? "");
	const [noIndex, setNoIndex] = useState(initial?.noIndex ?? false);
	const [noFollow, setNoFollow] = useState(initial?.noFollow ?? false);

	const mutation = api.upsertMeta.useMutation({
		onSuccess: () => {
			void api.listMeta.invalidate();
			onSuccess();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		mutation.mutate({
			path,
			...(title ? { title } : {}),
			...(description ? { description } : {}),
			...(canonicalUrl ? { canonicalUrl } : {}),
			...(ogTitle ? { ogTitle } : {}),
			...(ogDescription ? { ogDescription } : {}),
			...(ogImage ? { ogImage } : {}),
			noIndex,
			noFollow,
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
			>
				<form onSubmit={handleSubmit}>
					<div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
						<h2 className="font-semibold text-foreground text-lg">
							{initial ? "Edit Meta Tags" : "Add Meta Tags"}
						</h2>

						<div>
							<label
								htmlFor="seo-path"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Path *
							</label>
							<input
								ref={firstInputRef}
								id="seo-path"
								type="text"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="/products/example"
								required
								disabled={!!initial}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							/>
						</div>

						<div>
							<label
								htmlFor="seo-title"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Title
							</label>
							<input
								id="seo-title"
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Page Title"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div>
							<label
								htmlFor="seo-description"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Description
							</label>
							<textarea
								id="seo-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Page description for search engines"
								rows={2}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div>
							<label
								htmlFor="seo-canonical"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Canonical URL
							</label>
							<input
								id="seo-canonical"
								type="url"
								value={canonicalUrl}
								onChange={(e) => setCanonicalUrl(e.target.value)}
								placeholder="https://example.com/canonical-page"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="seo-og-title"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									OG Title
								</label>
								<input
									id="seo-og-title"
									type="text"
									value={ogTitle}
									onChange={(e) => setOgTitle(e.target.value)}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="seo-og-image"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									OG Image
								</label>
								<input
									id="seo-og-image"
									type="url"
									value={ogImage}
									onChange={(e) => setOgImage(e.target.value)}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="seo-og-desc"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								OG Description
							</label>
							<textarea
								id="seo-og-desc"
								value={ogDescription}
								onChange={(e) => setOgDescription(e.target.value)}
								rows={2}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div className="flex gap-6">
							<label className="flex items-center gap-2 text-foreground text-sm">
								<input
									type="checkbox"
									checked={noIndex}
									onChange={(e) => setNoIndex(e.target.checked)}
									className="rounded border-border"
								/>
								noindex
							</label>
							<label className="flex items-center gap-2 text-foreground text-sm">
								<input
									type="checkbox"
									checked={noFollow}
									onChange={(e) => setNoFollow(e.target.checked)}
									className="rounded border-border"
								/>
								nofollow
							</label>
						</div>
					</div>

					<div className="flex justify-end gap-2 border-border border-t px-6 py-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={mutation.isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{mutation.isPending ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ── Redirect Form ─────────────────────────────────────────────────────────

function RedirectForm({
	initial,
	onSuccess,
	onCancel,
}: {
	initial?: Redirect | null;
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const api = useSeoAdminApi();
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [fromPath, setFromPath] = useState(initial?.fromPath ?? "");
	const [toPath, setToPath] = useState(initial?.toPath ?? "");
	const [statusCode, setStatusCode] = useState(
		String(initial?.statusCode ?? "301"),
	);

	const createMutation = api.createRedirect.useMutation({
		onSuccess: () => {
			void api.listRedirects.invalidate();
			onSuccess();
		},
	});

	const updateMutation = api.updateRedirect.useMutation({
		onSuccess: () => {
			void api.listRedirects.invalidate();
			onSuccess();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (initial) {
			updateMutation.mutate({
				params: { id: initial.id },
				fromPath,
				toPath,
				statusCode,
			});
		} else {
			createMutation.mutate({ fromPath, toPath, statusCode });
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
			>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 px-6 py-5">
						<h2 className="font-semibold text-foreground text-lg">
							{initial ? "Edit Redirect" : "Add Redirect"}
						</h2>

						<div>
							<label
								htmlFor="redirect-from"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								From Path *
							</label>
							<input
								ref={firstInputRef}
								id="redirect-from"
								type="text"
								value={fromPath}
								onChange={(e) => setFromPath(e.target.value)}
								placeholder="/old-page"
								required
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div>
							<label
								htmlFor="redirect-to"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								To Path *
							</label>
							<input
								id="redirect-to"
								type="text"
								value={toPath}
								onChange={(e) => setToPath(e.target.value)}
								placeholder="/new-page"
								required
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div>
							<label
								htmlFor="redirect-status"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Status Code
							</label>
							<select
								id="redirect-status"
								value={statusCode}
								onChange={(e) => setStatusCode(e.target.value)}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="301">301 — Permanent</option>
								<option value="302">302 — Temporary</option>
								<option value="307">307 — Temporary (preserve method)</option>
								<option value="308">308 — Permanent (preserve method)</option>
							</select>
						</div>
					</div>

					<div className="flex justify-end gap-2 border-border border-t px-6 py-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{isPending ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteModal({
	label,
	onClose,
	onConfirm,
	isPending,
}: {
	label: string;
	onClose: () => void;
	onConfirm: () => void;
	isPending: boolean;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">Delete?</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{label}</span> will be
						permanently deleted.
					</p>
				</div>
				<div className="flex justify-end gap-2 border-border border-t px-6 py-4">
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
						onClick={onConfirm}
						disabled={isPending}
						className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
					>
						{isPending ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Meta Tags Tab ─────────────────────────────────────────────────────────

function MetaTagsTab() {
	const api = useSeoAdminApi();
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<MetaTag | null>(null);
	const [deleting, setDeleting] = useState<MetaTag | null>(null);

	const anyMetaModalOpen = showForm || !!deleting;
	useEffect(() => {
		if (!anyMetaModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowForm(false);
				setDeleting(null);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyMetaModalOpen]);

	const {
		data,
		isLoading,
		isError: metaTagsError,
		refetch: refetchMetaTags,
	} = api.listMeta.useQuery({}) as {
		data: { metaTags?: unknown[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deleteMutation = api.deleteMeta.useMutation({
		onSuccess: () => {
			void api.listMeta.invalidate();
			setDeleting(null);
		},
	});

	if (metaTagsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load SEO meta tags
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchMetaTags()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const metaTags = (data?.metaTags ?? []) as MetaTag[];

	return (
		<div>
			<div className="mb-4 flex justify-end">
				<button
					type="button"
					onClick={() => {
						setEditing(null);
						setShowForm(true);
					}}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
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
						<line x1="12" x2="12" y1="5" y2="19" />
						<line x1="5" x2="19" y1="12" y2="12" />
					</svg>
					Add Meta Tags
				</button>
			</div>

			{isLoading ? (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<div className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, _i) => (
							<div key={key} className="flex gap-4 px-4 py-3">
								<Skeleton className="h-4 w-1/4" />
								<Skeleton className="h-4 w-1/3" />
								<Skeleton className="h-4 w-1/5" />
							</div>
						))}
					</div>
				</div>
			) : metaTags.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No meta tags configured yet.
				</p>
			) : (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th
									scope="col"
									className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Path
								</th>
								<th
									scope="col"
									className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
								>
									Title
								</th>
								<th
									scope="col"
									className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
								>
									Robots
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
							{metaTags.map((meta) => (
								<tr key={meta.id} className="hover:bg-muted/30">
									<td className="px-4 py-3 font-mono text-foreground text-sm">
										{meta.path}
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
										{meta.title || "—"}
									</td>
									<td className="hidden px-4 py-3 lg:table-cell">
										<div className="flex gap-1">
											{meta.noIndex && (
												<span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-400">
													noindex
												</span>
											)}
											{meta.noFollow && (
												<span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-400">
													nofollow
												</span>
											)}
											{!meta.noIndex && !meta.noFollow && (
												<span className="text-muted-foreground text-xs">
													index, follow
												</span>
											)}
										</div>
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-1">
											<button
												type="button"
												onClick={() => {
													setEditing(meta);
													setShowForm(true);
												}}
												className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => setDeleting(meta)}
												className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-destructive/10 hover:text-destructive"
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
			)}

			{showForm && (
				<MetaTagForm
					initial={editing}
					onSuccess={() => setShowForm(false)}
					onCancel={() => setShowForm(false)}
				/>
			)}

			{deleting && (
				<DeleteModal
					label={deleting.path}
					isPending={deleteMutation.isPending}
					onClose={() => setDeleting(null)}
					onConfirm={() =>
						deleteMutation.mutate({ params: { id: deleting.id } })
					}
				/>
			)}
		</div>
	);
}

// ── Redirects Tab ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive: "bg-muted text-muted-foreground",
};

function RedirectsTab() {
	const api = useSeoAdminApi();
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<Redirect | null>(null);
	const [deleting, setDeleting] = useState<Redirect | null>(null);

	const anyRedirectModalOpen = showForm || !!deleting;
	useEffect(() => {
		if (!anyRedirectModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowForm(false);
				setDeleting(null);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyRedirectModalOpen]);

	const { data, isLoading } = api.listRedirects.useQuery({});

	const deleteMutation = api.deleteRedirect.useMutation({
		onSuccess: () => {
			void api.listRedirects.invalidate();
			setDeleting(null);
		},
	});

	const toggleMutation = api.updateRedirect.useMutation({
		onSuccess: () => void api.listRedirects.invalidate(),
	});

	const redirects = (data?.redirects ?? []) as Redirect[];

	return (
		<div>
			<div className="mb-4 flex justify-end">
				<button
					type="button"
					onClick={() => {
						setEditing(null);
						setShowForm(true);
					}}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
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
						<line x1="12" x2="12" y1="5" y2="19" />
						<line x1="5" x2="19" y1="12" y2="12" />
					</svg>
					Add Redirect
				</button>
			</div>

			{isLoading ? (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<div className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, _i) => (
							<div key={key} className="flex gap-4 px-4 py-3">
								<Skeleton className="h-4 w-1/4" />
								<Skeleton className="h-4 w-1/3" />
								<Skeleton className="h-4 w-1/5" />
							</div>
						))}
					</div>
				</div>
			) : redirects.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No redirects configured yet.
				</p>
			) : (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th
									scope="col"
									className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									From
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									To
								</th>
								<th
									scope="col"
									className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
								>
									Status
								</th>
								<th
									scope="col"
									className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
								>
									State
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
							{redirects.map((r) => (
								<tr key={r.id} className="hover:bg-muted/30">
									<td className="px-4 py-3 font-mono text-foreground text-sm">
										{r.fromPath}
									</td>
									<td className="px-4 py-3 font-mono text-muted-foreground text-sm">
										{r.toPath}
									</td>
									<td className="hidden px-4 py-3 md:table-cell">
										<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
											{r.statusCode}
										</span>
									</td>
									<td className="hidden px-4 py-3 lg:table-cell">
										<span
											className={`rounded px-1.5 py-0.5 text-xs ${
												r.active ? STATUS_COLORS.active : STATUS_COLORS.inactive
											}`}
										>
											{r.active ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-1">
											<button
												type="button"
												onClick={() =>
													toggleMutation.mutate({
														params: { id: r.id },
														active: !r.active,
													})
												}
												className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
											>
												{r.active ? "Disable" : "Enable"}
											</button>
											<button
												type="button"
												onClick={() => {
													setEditing(r);
													setShowForm(true);
												}}
												className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => setDeleting(r)}
												className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-destructive/10 hover:text-destructive"
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
			)}

			{showForm && (
				<RedirectForm
					initial={editing}
					onSuccess={() => setShowForm(false)}
					onCancel={() => setShowForm(false)}
				/>
			)}

			{deleting && (
				<DeleteModal
					label={`${deleting.fromPath} → ${deleting.toPath}`}
					isPending={deleteMutation.isPending}
					onClose={() => setDeleting(null)}
					onConfirm={() =>
						deleteMutation.mutate({
							params: { id: deleting.id },
						})
					}
				/>
			)}
		</div>
	);
}

// ── Main Component ────────────────────────────────────────────────────────

export function SeoAdmin() {
	const [activeTab, setActiveTab] = useState<"meta" | "redirects">("meta");

	return (
		<SeoAdminTemplate
			activeTab={activeTab}
			onTabChange={setActiveTab}
			content={activeTab === "meta" ? <MetaTagsTab /> : <RedirectsTab />}
		/>
	);
}
