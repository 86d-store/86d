"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import DownloadsAdminTemplate from "./downloads-admin.mdx";

// ── Types ──────────────────────────────────────────────────────────────────

interface DownloadableFile {
	id: string;
	productId: string;
	name: string;
	url: string;
	fileSize?: number | null;
	mimeType?: string | null;
	isActive: boolean;
}

interface DownloadToken {
	id: string;
	token: string;
	fileId: string;
	orderId?: string | null;
	email: string;
	maxDownloads?: number | null;
	downloadCount: number;
	expiresAt?: string | null;
	revokedAt?: string | null;
	createdAt: string;
}

interface FileForm {
	productId: string;
	name: string;
	url: string;
	fileSize: string;
	mimeType: string;
	isActive: boolean;
}

interface TokenForm {
	fileId: string;
	email: string;
	orderId: string;
	maxDownloads: string;
	expiresAt: string;
}

const DEFAULT_FILE: FileForm = {
	productId: "",
	name: "",
	url: "",
	fileSize: "",
	mimeType: "",
	isActive: true,
};

const DEFAULT_TOKEN: TokenForm = {
	fileId: "",
	email: "",
	orderId: "",
	maxDownloads: "",
	expiresAt: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
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

// ── Hook ───────────────────────────────────────────────────────────────────

function useDownloadsAdminApi() {
	const client = useModuleClient();
	return {
		listFiles:
			client.module("digital-downloads").admin["/admin/downloads/files"],
		createFile:
			client.module("digital-downloads").admin["/admin/downloads/files/create"],
		deleteFile:
			client.module("digital-downloads").admin[
				"/admin/downloads/files/:id/delete"
			],
		listTokens:
			client.module("digital-downloads").admin["/admin/downloads/tokens"],
		createToken:
			client.module("digital-downloads").admin[
				"/admin/downloads/tokens/create"
			],
	};
}

// ── Files tab ──────────────────────────────────────────────────────────────

function FilesTab({
	onSelectFile,
}: {
	onSelectFile: (file: DownloadableFile) => void;
}) {
	const api = useDownloadsAdminApi();
	const fileProductIdRef = useRef<HTMLInputElement>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<FileForm>(DEFAULT_FILE);
	const [error, setError] = useState("");

	const { data: filesData, isLoading: loading } = api.listFiles.useQuery({
		take: "100",
	}) as {
		data: { files: DownloadableFile[] } | undefined;
		isLoading: boolean;
	};
	const files = filesData?.files ?? [];

	useEffect(() => {
		if (!showCreate) return;
		fileProductIdRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	const createFileMutation = api.createFile.useMutation({
		onSettled: () => {
			void api.listFiles.invalidate();
		},
	});

	const deleteFileMutation = api.deleteFile.useMutation({
		onSettled: () => {
			void api.listFiles.invalidate();
		},
	});

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const body: Record<string, unknown> = {
			productId: form.productId,
			name: form.name,
			url: form.url,
			isActive: form.isActive,
		};
		if (form.fileSize) body.fileSize = Number(form.fileSize);
		if (form.mimeType) body.mimeType = form.mimeType;

		createFileMutation.mutate(body, {
			onSuccess: () => {
				setShowCreate(false);
				setForm(DEFAULT_FILE);
			},
			onError: (err) => {
				setError(extractError(err, "Failed to create file"));
			},
		});
	}

	function handleDelete(id: string) {
		if (
			!confirm("Delete this file? All tokens for this file will stop working.")
		)
			return;
		deleteFileMutation.mutate({ params: { id } });
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{files.length} file{files.length !== 1 ? "s" : ""}
				</p>
				<button
					type="button"
					onClick={() => {
						setForm(DEFAULT_FILE);
						setShowCreate(true);
					}}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
				>
					Add file
				</button>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								File
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Product
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Size / Type
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Status
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
							(["k0", "k1", "k2", "k3"] as const).map((_key) => (
								<tr key={rowKey}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
										<td key={cellKey} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : files.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No files yet
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Add downloadable files to associate with your digital
										products
									</p>
								</td>
							</tr>
						) : (
							files.map((file) => (
								<tr
									key={file.id}
									className="transition-colors hover:bg-muted/30"
								>
									<td className="px-4 py-3">
										<div className="font-medium text-foreground text-sm">
											{file.name}
										</div>
										<div className="mt-0.5 max-w-[200px] truncate text-muted-foreground text-xs">
											{file.url}
										</div>
									</td>
									<td className="hidden px-4 py-3 font-mono text-muted-foreground text-sm sm:table-cell">
										{file.productId}
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
										{file.fileSize != null ? formatBytes(file.fileSize) : "—"}
										{file.mimeType && (
											<span className="ml-2 text-xs">{file.mimeType}</span>
										)}
									</td>
									<td className="px-4 py-3">
										{file.isActive ? (
											<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
												Active
											</span>
										) : (
											<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
												Inactive
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex items-center justify-end gap-2">
											<button
												type="button"
												onClick={() => onSelectFile(file)}
												className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
											>
												Tokens
											</button>
											<button
												type="button"
												onClick={() => handleDelete(file.id)}
												className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Create File Modal */}
			{showCreate && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
					>
						<h2 className="mb-4 font-semibold text-foreground text-lg">
							Add downloadable file
						</h2>
						{error && (
							<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
								{error}
							</p>
						)}
						<form onSubmit={(e) => handleCreate(e)} className="space-y-4">
							<div>
								<label
									htmlFor="dl-file-productId"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Product ID <span className="text-red-500">*</span>
								</label>
								<input
									ref={fileProductIdRef}
									id="dl-file-productId"
									required
									value={form.productId}
									onChange={(e) =>
										setForm((f) => ({ ...f, productId: e.target.value }))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="dl-file-name"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									File name <span className="text-red-500">*</span>
								</label>
								<input
									id="dl-file-name"
									required
									value={form.name}
									onChange={(e) =>
										setForm((f) => ({ ...f, name: e.target.value }))
									}
									placeholder="e.g. Course Materials v2.pdf"
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="dl-file-url"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Storage URL <span className="text-red-500">*</span>
								</label>
								<input
									id="dl-file-url"
									required
									type="url"
									value={form.url}
									onChange={(e) =>
										setForm((f) => ({ ...f, url: e.target.value }))
									}
									placeholder="https://..."
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="dl-file-size"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										File size (bytes)
									</label>
									<input
										id="dl-file-size"
										type="number"
										min={0}
										value={form.fileSize}
										onChange={(e) =>
											setForm((f) => ({ ...f, fileSize: e.target.value }))
										}
										placeholder="optional"
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
								<div>
									<label
										htmlFor="dl-file-mimeType"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										MIME type
									</label>
									<input
										id="dl-file-mimeType"
										value={form.mimeType}
										onChange={(e) =>
											setForm((f) => ({ ...f, mimeType: e.target.value }))
										}
										placeholder="e.g. application/pdf"
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							</div>
							<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
								<input
									type="checkbox"
									checked={form.isActive}
									onChange={(e) =>
										setForm((f) => ({ ...f, isActive: e.target.checked }))
									}
									className="rounded"
								/>
								Active
							</label>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowCreate(false)}
									className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createFileMutation.isPending}
									className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
								>
									{createFileMutation.isPending ? "Saving…" : "Add file"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Tokens tab ─────────────────────────────────────────────────────────────

function TokensTab({
	fileFilter,
	onClearFileFilter,
}: {
	fileFilter: DownloadableFile | null;
	onClearFileFilter: () => void;
}) {
	const api = useDownloadsAdminApi();
	const tokenFileIdRef = useRef<HTMLInputElement>(null);
	const [emailFilter, setEmailFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<TokenForm>(DEFAULT_TOKEN);
	const [error, setError] = useState("");

	const tokenQueryInput: Record<string, string> = { take: "100" };
	if (fileFilter) tokenQueryInput.fileId = fileFilter.id;
	if (emailFilter) tokenQueryInput.email = emailFilter;

	const { data: tokensData, isLoading: loading } = api.listTokens.useQuery(
		tokenQueryInput,
	) as {
		data: { tokens: DownloadToken[] } | undefined;
		isLoading: boolean;
	};
	const tokens = tokensData?.tokens ?? [];

	useEffect(() => {
		if (fileFilter) setForm((f) => ({ ...f, fileId: fileFilter.id }));
	}, [fileFilter]);

	useEffect(() => {
		if (!showCreate) return;
		tokenFileIdRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	const createTokenMutation = api.createToken.useMutation({
		onSettled: () => {
			void api.listTokens.invalidate();
		},
	});

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const body: Record<string, unknown> = {
			fileId: form.fileId,
			email: form.email,
		};
		if (form.orderId) body.orderId = form.orderId;
		if (form.maxDownloads) body.maxDownloads = Number(form.maxDownloads);
		if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();

		createTokenMutation.mutate(body, {
			onSuccess: () => {
				setShowCreate(false);
				setForm({ ...DEFAULT_TOKEN, fileId: fileFilter?.id ?? "" });
			},
			onError: (err) => {
				setError(extractError(err, "Failed to create token"));
			},
		});
	}

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<div className="mr-auto flex items-center gap-2">
					<p className="text-muted-foreground text-sm">
						{tokens.length} token{tokens.length !== 1 ? "s" : ""}
					</p>
					{fileFilter && (
						<span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground text-xs">
							{fileFilter.name}
							<button
								type="button"
								onClick={onClearFileFilter}
								aria-label="Clear file filter"
								className="ml-1 text-muted-foreground hover:text-foreground"
							>
								×
							</button>
						</span>
					)}
				</div>
				<input
					type="search"
					aria-label="Filter by email"
					placeholder="Filter by email…"
					value={emailFilter}
					onChange={(e) => setEmailFilter(e.target.value)}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<button
					type="button"
					onClick={() => {
						setForm({ ...DEFAULT_TOKEN, fileId: fileFilter?.id ?? "" });
						setShowCreate(true);
					}}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
				>
					Issue token
				</button>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Email
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Downloads
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Expires
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								State
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Issued
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2", "k3"] as const).map((_key) => (
								<tr key={rowKey}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
										<td key={cellKey} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : tokens.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No tokens
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Issue tokens to grant customers download access
									</p>
								</td>
							</tr>
						) : (
							tokens.map((token) => {
								const isRevoked = !!token.revokedAt;
								const isExpired =
									!isRevoked &&
									token.expiresAt != null &&
									new Date(token.expiresAt) < new Date();
								const isExhausted =
									!isRevoked &&
									token.maxDownloads != null &&
									token.downloadCount >= token.maxDownloads;
								const state = isRevoked
									? "Revoked"
									: isExpired
										? "Expired"
										: isExhausted
											? "Exhausted"
											: "Active";
								const stateColor =
									isRevoked || isExpired || isExhausted
										? "bg-muted text-muted-foreground"
										: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";

								return (
									<tr
										key={token.id}
										className="transition-colors hover:bg-muted/30"
									>
										<td className="px-4 py-3 text-foreground text-sm">
											{token.email}
										</td>
										<td className="hidden px-4 py-3 text-right text-muted-foreground text-sm tabular-nums sm:table-cell">
											{token.downloadCount}
											{token.maxDownloads != null
												? ` / ${token.maxDownloads}`
												: ""}
										</td>
										<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
											{token.expiresAt ? formatDate(token.expiresAt) : "Never"}
										</td>
										<td className="px-4 py-3">
											<span
												className={`rounded-full px-2 py-0.5 font-medium text-xs ${stateColor}`}
											>
												{state}
											</span>
										</td>
										<td className="hidden px-4 py-3 text-muted-foreground text-sm lg:table-cell">
											{formatDate(token.createdAt)}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* Issue Token Modal */}
			{showCreate && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
					>
						<h2 className="mb-4 font-semibold text-foreground text-lg">
							Issue download token
						</h2>
						{error && (
							<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
								{error}
							</p>
						)}
						<form onSubmit={(e) => handleCreate(e)} className="space-y-4">
							<div>
								<label
									htmlFor="dl-token-fileId"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									File ID <span className="text-red-500">*</span>
								</label>
								<input
									ref={tokenFileIdRef}
									id="dl-token-fileId"
									required
									value={form.fileId}
									onChange={(e) =>
										setForm((f) => ({ ...f, fileId: e.target.value }))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="dl-token-email"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Customer email <span className="text-red-500">*</span>
								</label>
								<input
									id="dl-token-email"
									required
									type="email"
									value={form.email}
									onChange={(e) =>
										setForm((f) => ({ ...f, email: e.target.value }))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="dl-token-orderId"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Order ID
								</label>
								<input
									id="dl-token-orderId"
									value={form.orderId}
									onChange={(e) =>
										setForm((f) => ({ ...f, orderId: e.target.value }))
									}
									placeholder="optional"
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="dl-token-maxDownloads"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Max downloads
									</label>
									<input
										id="dl-token-maxDownloads"
										type="number"
										min={1}
										value={form.maxDownloads}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												maxDownloads: e.target.value,
											}))
										}
										placeholder="unlimited"
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
								<div>
									<label
										htmlFor="dl-token-expiresAt"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Expires at
									</label>
									<input
										id="dl-token-expiresAt"
										type="datetime-local"
										value={form.expiresAt}
										onChange={(e) =>
											setForm((f) => ({ ...f, expiresAt: e.target.value }))
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							</div>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowCreate(false)}
									className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createTokenMutation.isPending}
									className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
								>
									{createTokenMutation.isPending ? "Issuing…" : "Issue token"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DownloadsAdmin() {
	const [tab, setTab] = useState<"files" | "tokens">("files");
	const [selectedFile, setSelectedFile] = useState<DownloadableFile | null>(
		null,
	);

	function handleSelectFile(file: DownloadableFile) {
		setSelectedFile(file);
		setTab("tokens");
	}

	return (
		<DownloadsAdminTemplate
			tab={tab}
			onTabChange={setTab}
			tabContent={
				tab === "files" ? (
					<FilesTab onSelectFile={handleSelectFile} />
				) : (
					<TokensTab
						fileFilter={selectedFile}
						onClearFileFilter={() => setSelectedFile(null)}
					/>
				)
			}
		/>
	);
}
