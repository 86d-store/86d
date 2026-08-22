"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import QrCodeListTemplate from "./qr-code-list.mdx";

interface QrCode {
	id: string;
	label: string;
	targetUrl: string;
	targetType: string;
	targetId?: string;
	format: string;
	size: number;
	errorCorrection: string;
	scanCount: number;
	isActive: boolean;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface ListResult {
	qrCodes: QrCode[];
	total: number;
}

const TARGET_TYPE_COLORS: Record<string, string> = {
	product:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	collection:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	page: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	order:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	custom: "bg-muted text-muted-foreground",
};

function truncateUrl(url: string, maxLen = 40): string {
	if (url.length <= maxLen) return url;
	return `${url.slice(0, maxLen)}...`;
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

function useQrCodeAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("qr-code").admin["/admin/qr-codes"],
		create: client.module("qr-code").admin["/admin/qr-codes/create"],
		batchCreate: client.module("qr-code").admin["/admin/qr-codes/batch"],
		delete: client.module("qr-code").admin["/admin/qr-codes/:id/delete"],
	};
}

const PAGE_SIZE = 20;

function CreateForm({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useQrCodeAdminApi();
	const [label, setLabel] = useState("");
	const [targetUrl, setTargetUrl] = useState("");
	const [targetType, setTargetType] = useState("custom");
	const [format, setFormat] = useState("svg");
	const [size, setSize] = useState("256");
	const [errorCorrection, setErrorCorrection] = useState("M");
	const [error, setError] = useState("");
	const [showBatch, setShowBatch] = useState(false);
	const [batchUrls, setBatchUrls] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			onSuccess();
			onClose();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create QR code."));
		},
	});

	const batchMutation = api.batchCreate.useMutation({
		onSuccess: () => {
			onSuccess();
			onClose();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to batch create QR codes."));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!targetUrl.trim()) {
			setError("Target URL is required.");
			return;
		}
		const sizeNum = Number.parseInt(size, 10);
		if (Number.isNaN(sizeNum) || sizeNum < 32 || sizeNum > 2048) {
			setError("Size must be between 32 and 2048.");
			return;
		}

		createMutation.mutate({
			targetUrl: targetUrl.trim(),
			targetType,
			format,
			size: sizeNum,
			errorCorrection,
			...(label.trim() ? { label: label.trim() } : {}),
		});
	};

	const handleBatchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const urls = batchUrls
			.split(",")
			.map((u) => u.trim())
			.filter(Boolean);
		if (urls.length === 0) {
			setError("Enter at least one URL.");
			return;
		}

		batchMutation.mutate({
			urls,
			targetType,
			format,
			size: Number.parseInt(size, 10) || 256,
			errorCorrection,
		});
	};

	return (
		<div className="mb-4 rounded-lg border border-border bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="font-semibold text-foreground text-sm">
					{showBatch ? "Batch Create QR Codes" : "Create QR Code"}
				</h4>
				<button
					type="button"
					onClick={() => setShowBatch(!showBatch)}
					className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
				>
					{showBatch ? "Single create" : "Batch create"}
				</button>
			</div>
			{error && (
				<div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 text-xs dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
					{error}
				</div>
			)}
			{showBatch ? (
				<form onSubmit={handleBatchSubmit}>
					<label className="mb-3 block">
						<span className="mb-1 block text-muted-foreground text-xs">
							URLs (comma-separated) *
						</span>
						<textarea
							value={batchUrls}
							onChange={(e) => setBatchUrls(e.target.value)}
							placeholder="https://example.com/product/1, https://example.com/product/2"
							rows={3}
							required
							className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
						/>
					</label>
					<div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Target type
							</span>
							<select
								value={targetType}
								onChange={(e) => setTargetType(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="product">Product</option>
								<option value="collection">Collection</option>
								<option value="page">Page</option>
								<option value="order">Order</option>
								<option value="custom">Custom</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Format
							</span>
							<select
								value={format}
								onChange={(e) => setFormat(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="svg">SVG</option>
								<option value="png">PNG</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Size (px)
							</span>
							<input
								type="number"
								min="32"
								max="2048"
								value={size}
								onChange={(e) => setSize(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Error correction
							</span>
							<select
								value={errorCorrection}
								onChange={(e) => setErrorCorrection(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="L">L (Low)</option>
								<option value="M">M (Medium)</option>
								<option value="Q">Q (Quartile)</option>
								<option value="H">H (High)</option>
							</select>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={batchMutation.isPending}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
						>
							{batchMutation.isPending ? "Creating..." : "Batch Create"}
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			) : (
				<form onSubmit={handleSubmit}>
					<div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Label
							</span>
							<input
								type="text"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="My QR Code"
								maxLength={200}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Target URL *
							</span>
							<input
								type="text"
								value={targetUrl}
								onChange={(e) => setTargetUrl(e.target.value)}
								placeholder="https://example.com/product/abc"
								required
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
					</div>
					<div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Target type
							</span>
							<select
								value={targetType}
								onChange={(e) => setTargetType(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="product">Product</option>
								<option value="collection">Collection</option>
								<option value="page">Page</option>
								<option value="order">Order</option>
								<option value="custom">Custom</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Format
							</span>
							<select
								value={format}
								onChange={(e) => setFormat(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="svg">SVG</option>
								<option value="png">PNG</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Size (px)
							</span>
							<input
								type="number"
								min="32"
								max="2048"
								value={size}
								onChange={(e) => setSize(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-xs">
								Error correction
							</span>
							<select
								value={errorCorrection}
								onChange={(e) => setErrorCorrection(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="L">L (Low)</option>
								<option value="M">M (Medium)</option>
								<option value="Q">Q (Quartile)</option>
								<option value="H">H (High)</option>
							</select>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create QR Code"}
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</form>
			)}
		</div>
	);
}

export function QrCodeList() {
	const api = useQrCodeAdminApi();
	const [page, setPage] = useState(1);
	const [targetTypeFilter, setTargetTypeFilter] = useState("");
	const [isActiveFilter, setIsActiveFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (targetTypeFilter !== "") queryInput.targetType = targetTypeFilter;
	if (isActiveFilter !== "") queryInput.isActive = isActiveFilter;

	const { data: listData, isLoading: loading } = api.list.useQuery(
		queryInput,
	) as {
		data: ListResult | undefined;
		isLoading: boolean;
	};

	const qrCodes = listData?.qrCodes ?? [];
	const total = listData?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const deleteMutation = api.delete.useMutation({
		onSettled: () => {
			void api.list.invalidate();
		},
	});

	const handleDelete = (id: string) => {
		if (!confirm("Delete this QR code? This cannot be undone.")) return;
		deleteMutation.mutate({ params: { id } });
	};

	const handleRefresh = () => {
		void api.list.invalidate();
	};

	const subtitle = `${total} ${total === 1 ? "QR code" : "QR codes"}`;

	const tableBody = loading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
			<tr key={key}>
				{(["k0", "k1", "k2", "k3", "k4", "k5", "k6", "k7"] as const).map(
					(_key) => (
						<td key={key} className="px-4 py-3">
							<div className="h-4 w-20 animate-pulse rounded bg-muted" />
						</td>
					),
				)}
			</tr>
		))
	) : qrCodes.length === 0 ? (
		<tr>
			<td colSpan={8} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No QR codes yet</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create QR codes to link to products, collections, pages, or custom
					URLs
				</p>
			</td>
		</tr>
	) : (
		qrCodes.map((qr) => (
			<tr
				key={qr.id}
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={() => {
					window.location.href = `/admin/qr-codes/${qr.id}`;
				}}
			>
				<td className="px-4 py-3 font-medium text-foreground text-sm">
					<a
						href={`/admin/qr-codes/${qr.id}`}
						className="hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{qr.label || "Untitled"}
					</a>
				</td>
				<td className="hidden max-w-[200px] px-4 py-3 text-muted-foreground text-sm sm:table-cell">
					<span title={qr.targetUrl}>{truncateUrl(qr.targetUrl)}</span>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${
							TARGET_TYPE_COLORS[qr.targetType] ?? TARGET_TYPE_COLORS.custom
						}`}
					>
						{qr.targetType}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-center text-muted-foreground text-sm uppercase md:table-cell">
					{qr.format}
				</td>
				<td className="hidden px-4 py-3 text-center text-muted-foreground text-sm md:table-cell">
					{qr.size}px
				</td>
				<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
					{qr.scanCount}
				</td>
				<td className="px-4 py-3 text-center">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
							qr.isActive
								? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{qr.isActive ? "Active" : "Inactive"}
					</span>
				</td>
				<td
					className="px-4 py-3 text-right"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-end gap-1">
						<a
							href={`/admin/qr-codes/${qr.id}`}
							className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
						>
							View
						</a>
						<button
							type="button"
							onClick={() => handleDelete(qr.id)}
							className="rounded-md px-2.5 py-1.5 font-medium text-destructive text-xs transition-colors hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	const createForm = showCreate ? (
		<CreateForm
			onClose={() => setShowCreate(false)}
			onSuccess={handleRefresh}
		/>
	) : null;

	return (
		<QrCodeListTemplate
			subtitle={subtitle}
			targetTypeFilter={targetTypeFilter}
			onTargetTypeChange={(v: string) => {
				setTargetTypeFilter(v);
				setPage(1);
			}}
			isActiveFilter={isActiveFilter}
			onActiveChange={(v: string) => {
				setIsActiveFilter(v);
				setPage(1);
			}}
			onToggleCreate={() => setShowCreate(!showCreate)}
			createForm={createForm}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
		/>
	);
}
