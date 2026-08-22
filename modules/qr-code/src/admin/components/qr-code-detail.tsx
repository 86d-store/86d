"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import QrCodeDetailTemplate from "./qr-code-detail.mdx";

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

interface QrScan {
	id: string;
	qrCodeId: string;
	scannedAt: string;
	userAgent?: string;
	ipAddress?: string;
	referrer?: string;
}

interface ScansResult {
	scans: QrScan[];
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

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
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

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useQrCodeAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("qr-code").admin["/admin/qr-codes"],
		get: client.module("qr-code").admin["/admin/qr-codes/:id"],
		update: client.module("qr-code").admin["/admin/qr-codes/:id"],
		delete: client.module("qr-code").admin["/admin/qr-codes/:id/delete"],
		listScans: client.module("qr-code").admin["/admin/qr-codes/:id/scans"],
	};
}

const SCANS_PAGE_SIZE = 20;

function EditForm({
	qrCode,
	onClose,
	onSuccess,
}: {
	qrCode: QrCode;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useQrCodeAdminApi();
	const [label, setLabel] = useState(qrCode.label);
	const [targetUrl, setTargetUrl] = useState(qrCode.targetUrl);
	const [targetType, setTargetType] = useState(qrCode.targetType);
	const [format, setFormat] = useState(qrCode.format);
	const [size, setSize] = useState(String(qrCode.size));
	const [errorCorrection, setErrorCorrection] = useState(
		qrCode.errorCorrection,
	);
	const [isActive, setIsActive] = useState(qrCode.isActive);
	const [error, setError] = useState("");

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			onSuccess();
			onClose();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update QR code."));
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

		updateMutation.mutate({
			params: { id: qrCode.id },
			label: label.trim(),
			targetUrl: targetUrl.trim(),
			targetType,
			format,
			size: sizeNum,
			errorCorrection,
			isActive,
		});
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-border bg-card p-4"
		>
			<h4 className="mb-3 font-semibold text-foreground text-sm">
				Edit QR Code
			</h4>
			{error && (
				<div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 text-xs dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
					{error}
				</div>
			)}
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
						required
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
			</div>
			<div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
				<label className="flex items-end gap-2 pb-1">
					<input
						type="checkbox"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="h-4 w-4 rounded border-border"
					/>
					<span className="text-foreground text-sm">Active</span>
				</label>
			</div>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={updateMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm disabled:opacity-50"
				>
					{updateMutation.isPending ? "Saving..." : "Save Changes"}
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
	);
}

export function QrCodeDetail(props: {
	id?: string;
	params?: Record<string, string>;
}) {
	const qrCodeId = props.id ?? props.params?.id;
	const api = useQrCodeAdminApi();
	const [showEdit, setShowEdit] = useState(false);
	const [scansPage, setScansPage] = useState(1);

	const { data, isLoading } = api.get.useQuery(
		{ params: { id: qrCodeId ?? "" } },
		{ enabled: !!qrCodeId },
	) as {
		data: { qrCode: QrCode } | undefined;
		isLoading: boolean;
	};

	const { data: scansData, isLoading: scansLoading } = api.listScans.useQuery(
		{
			params: { id: qrCodeId ?? "" },
			page: String(scansPage),
			limit: String(SCANS_PAGE_SIZE),
		},
		{ enabled: !!qrCodeId },
	) as {
		data: ScansResult | undefined;
		isLoading: boolean;
	};

	const qrCode = data?.qrCode;
	const scans = scansData?.scans ?? [];
	const scansTotal = scansData?.total ?? 0;
	const scansTotalPages = Math.max(1, Math.ceil(scansTotal / SCANS_PAGE_SIZE));

	const deleteMutation = api.delete.useMutation({
		onSuccess: () => {
			window.location.href = "/admin/qr-codes";
		},
	});

	const handleDelete = () => {
		if (!confirm("Delete this QR code? This cannot be undone.")) return;
		deleteMutation.mutate({ params: { id: qrCodeId } });
	};

	const handleRefresh = () => {
		void api.get.invalidate();
		void api.list.invalidate();
	};

	if (!qrCodeId) {
		return (
			<QrCodeDetailTemplate
				content={
					<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
						<p className="font-medium">QR code not found</p>
						<p className="mt-1 text-sm">No QR code ID was provided.</p>
						<a
							href="/admin/qr-codes"
							className="mt-3 inline-block text-sm underline"
						>
							Back to QR codes
						</a>
					</div>
				}
			/>
		);
	}

	if (isLoading) {
		return (
			<QrCodeDetailTemplate
				content={
					<div className="space-y-4 p-1">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-48 w-full rounded-lg" />
						<div className="grid gap-4 sm:grid-cols-2">
							<Skeleton className="h-24 rounded-lg" />
							<Skeleton className="h-24 rounded-lg" />
						</div>
						<Skeleton className="h-32 w-full rounded-lg" />
					</div>
				}
			/>
		);
	}

	if (!qrCode) {
		return (
			<QrCodeDetailTemplate
				content={
					<div className="py-12 text-center">
						<p className="font-medium text-foreground text-sm">
							QR code not found
						</p>
						<a
							href="/admin/qr-codes"
							className="mt-2 inline-block text-muted-foreground text-sm hover:text-foreground"
						>
							Back to QR codes
						</a>
					</div>
				}
			/>
		);
	}

	const content = (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						{qrCode.label || "Untitled QR Code"}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{qrCode.targetUrl}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowEdit(!showEdit)}
						className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
					>
						{showEdit ? "Cancel Edit" : "Edit"}
					</button>
					<button
						type="button"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
						className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/30"
					>
						Delete
					</button>
				</div>
			</div>

			{/* Edit form */}
			{showEdit && (
				<EditForm
					qrCode={qrCode}
					onClose={() => setShowEdit(false)}
					onSuccess={handleRefresh}
				/>
			)}

			{/* Overview cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Target Type</p>
					<div className="mt-1">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${
								TARGET_TYPE_COLORS[qrCode.targetType] ??
								TARGET_TYPE_COLORS.custom
							}`}
						>
							{qrCode.targetType}
						</span>
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Status</p>
					<div className="mt-1">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
								qrCode.isActive
									? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{qrCode.isActive ? "Active" : "Inactive"}
						</span>
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Total Scans</p>
					<p className="mt-1 font-semibold text-foreground text-lg">
						{qrCode.scanCount}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Format / Size</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						{qrCode.format.toUpperCase()} &middot; {qrCode.size}px
					</p>
				</div>
			</div>

			{/* Details */}
			<div className="rounded-lg border border-border bg-card p-5">
				<h3 className="mb-3 font-semibold text-foreground text-sm">Details</h3>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
					<dt className="text-muted-foreground">Label</dt>
					<dd className="font-medium text-foreground">
						{qrCode.label || "---"}
					</dd>
					<dt className="text-muted-foreground">Target URL</dt>
					<dd className="break-all font-medium text-foreground">
						{qrCode.targetUrl}
					</dd>
					<dt className="text-muted-foreground">Target Type</dt>
					<dd className="font-medium text-foreground capitalize">
						{qrCode.targetType}
					</dd>
					{qrCode.targetId && (
						<>
							<dt className="text-muted-foreground">Target ID</dt>
							<dd className="font-medium font-mono text-foreground text-xs">
								{qrCode.targetId}
							</dd>
						</>
					)}
					<dt className="text-muted-foreground">Error Correction</dt>
					<dd className="font-medium text-foreground">
						{qrCode.errorCorrection}
					</dd>
					<dt className="text-muted-foreground">Created</dt>
					<dd className="font-medium text-foreground">
						{formatDate(qrCode.createdAt)}
					</dd>
					<dt className="text-muted-foreground">Updated</dt>
					<dd className="font-medium text-foreground">
						{formatDate(qrCode.updatedAt)}
					</dd>
				</dl>
			</div>

			{/* Scan History */}
			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Scan History ({scansTotal})
					</h3>
				</div>

				{scansLoading ? (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<tbody className="divide-y divide-border">
								{Array.from({ length: 5 }, (_, _i) => (
									<tr key={rowKey}>
										{Array.from({ length: 4 }, (_, _j) => (
											<td key={cellKey} className="px-5 py-3">
												<Skeleton className="h-4 rounded" />
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : scans.length === 0 ? (
					<div className="px-5 py-8 text-center">
						<p className="font-medium text-foreground text-sm">
							No scans recorded yet
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Scans will appear here as users scan this QR code
						</p>
					</div>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-border border-b bg-muted/50">
										<th
											scope="col"
											className="px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
										>
											Scanned At
										</th>
										<th
											scope="col"
											className="hidden px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
										>
											User Agent
										</th>
										<th
											scope="col"
											className="hidden px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
										>
											IP Address
										</th>
										<th
											scope="col"
											className="hidden px-5 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
										>
											Referrer
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{scans.map((scan) => (
										<tr
											key={scan.id}
											className="transition-colors hover:bg-muted/30"
										>
											<td className="whitespace-nowrap px-5 py-3 text-foreground">
												{formatDate(scan.scannedAt)}
											</td>
											<td className="hidden max-w-[250px] truncate px-5 py-3 text-muted-foreground sm:table-cell">
												{scan.userAgent || "---"}
											</td>
											<td className="hidden px-5 py-3 font-mono text-muted-foreground text-xs md:table-cell">
												{scan.ipAddress || "---"}
											</td>
											<td className="hidden max-w-[200px] truncate px-5 py-3 text-muted-foreground lg:table-cell">
												{scan.referrer || "---"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{scansTotalPages > 1 && (
							<div className="flex items-center justify-center gap-2 border-border border-t px-5 py-3">
								<button
									type="button"
									onClick={() => setScansPage((p) => Math.max(1, p - 1))}
									disabled={scansPage === 1}
									className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
								>
									Previous
								</button>
								<span className="text-muted-foreground text-sm">
									Page {scansPage} of {scansTotalPages}
								</span>
								<button
									type="button"
									onClick={() =>
										setScansPage((p) => Math.min(scansTotalPages, p + 1))
									}
									disabled={scansPage === scansTotalPages}
									className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
								>
									Next
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);

	return <QrCodeDetailTemplate content={content} />;
}
