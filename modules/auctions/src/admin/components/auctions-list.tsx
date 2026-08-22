"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuctionListItem {
	id: string;
	title: string;
	productName: string;
	type: "english" | "dutch" | "sealed";
	status: "draft" | "scheduled" | "active" | "ended" | "sold" | "cancelled";
	currentBid: number;
	startingPrice: number;
	reservePrice?: number;
	buyNowPrice?: number;
	bidIncrement?: number;
	priceDropAmount?: number;
	priceDropIntervalMinutes?: number;
	bidCount: number;
	startsAt: string;
	endsAt: string;
}

interface SummaryData {
	totalAuctions: number;
	active: number;
	scheduled: number;
	sold: number;
	totalBids: number;
	totalRevenue: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	ended:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	sold: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
	english: "English",
	dutch: "Dutch",
	sealed: "Sealed",
};

const STATUS_LABELS: Record<string, string> = {
	draft: "Draft",
	scheduled: "Scheduled",
	active: "Active",
	ended: "Ended",
	sold: "Sold",
	cancelled: "Cancelled",
};

function formatMoney(cents: number) {
	return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function toDatetimeLocal(dateStr: string) {
	const d = new Date(dateStr);
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── API hooks ────────────────────────────────────────────────────────────────

function useAuctionsApi() {
	const client = useModuleClient();
	return {
		list: client.module("auctions").admin["/admin/auctions"],
		summary: client.module("auctions").admin["/admin/auctions/summary"],
		create: client.module("auctions").admin["/admin/auctions/create"],
		update: client.module("auctions").admin["/admin/auctions/:id/update"],
		remove: client.module("auctions").admin["/admin/auctions/:id/delete"],
		publish: client.module("auctions").admin["/admin/auctions/:id/publish"],
		close: client.module("auctions").admin["/admin/auctions/:id/close"],
		cancel: client.module("auctions").admin["/admin/auctions/:id/cancel"],
	};
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({
	auction,
	onClose,
	onSuccess,
}: {
	auction: AuctionListItem;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useAuctionsApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.remove.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
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
						Delete auction?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{auction.title}</span>{" "}
						and all its bids will be permanently deleted. This cannot be undone.
					</p>
					{deleteMutation.error && (
						<p className="mt-2 text-destructive text-sm">
							{deleteMutation.error.message}
						</p>
					)}
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
								deleteMutation.mutate({ params: { id: auction.id } })
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

// ─── Auction form sheet ───────────────────────────────────────────────────────

interface AuctionFormProps {
	auction?: AuctionListItem;
	onSaved: () => void;
	onCancel: () => void;
}

function AuctionForm({ auction, onSaved, onCancel }: AuctionFormProps) {
	const api = useAuctionsApi();
	const isEditing = !!auction;
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);

	const [title, setTitle] = useState(auction?.title ?? "");
	const [productId, setProductId] = useState("");
	const [productName, setProductName] = useState(auction?.productName ?? "");
	const [type, setType] = useState<"english" | "dutch" | "sealed">(
		auction?.type ?? "english",
	);
	const [startingPrice, setStartingPrice] = useState(
		auction ? String((auction.startingPrice / 100).toFixed(2)) : "",
	);
	const [reservePrice, setReservePrice] = useState(
		auction?.reservePrice
			? String((auction.reservePrice / 100).toFixed(2))
			: "",
	);
	const [buyNowPrice, setBuyNowPrice] = useState(
		auction?.buyNowPrice ? String((auction.buyNowPrice / 100).toFixed(2)) : "",
	);
	const [bidIncrement, setBidIncrement] = useState(
		auction?.bidIncrement
			? String((auction.bidIncrement / 100).toFixed(2))
			: "",
	);
	const [priceDropAmount, setPriceDropAmount] = useState(
		auction?.priceDropAmount
			? String((auction.priceDropAmount / 100).toFixed(2))
			: "",
	);
	const [priceDropInterval, setPriceDropInterval] = useState(
		auction?.priceDropIntervalMinutes
			? String(auction.priceDropIntervalMinutes)
			: "",
	);
	const [startsAt, setStartsAt] = useState(
		auction ? toDatetimeLocal(auction.startsAt) : "",
	);
	const [endsAt, setEndsAt] = useState(
		auction ? toDatetimeLocal(auction.endsAt) : "",
	);
	const [antiSniping, setAntiSniping] = useState(false);
	const [antiSnipingMinutes, setAntiSnipingMinutes] = useState("5");
	const [error, setError] = useState("");

	const parseCents = (val: string) => Math.round(Number.parseFloat(val) * 100);

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(err.message),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (!title.trim()) {
			setError("Title is required");
			return;
		}
		if (!startsAt || !endsAt) {
			setError("Start and end time are required");
			return;
		}

		if (isEditing) {
			const body: Record<string, unknown> = {
				startsAt: new Date(startsAt),
				endsAt: new Date(endsAt),
			};
			if (title.trim()) body.title = title.trim();
			if (startingPrice) body.startingPrice = parseCents(startingPrice);
			if (reservePrice) body.reservePrice = parseCents(reservePrice);
			if (buyNowPrice) body.buyNowPrice = parseCents(buyNowPrice);
			if (auction?.type === "english" && bidIncrement)
				body.bidIncrement = parseCents(bidIncrement);
			if (auction?.type === "dutch") {
				if (priceDropAmount) body.priceDropAmount = parseCents(priceDropAmount);
				if (priceDropInterval)
					body.priceDropIntervalMinutes = Number(priceDropInterval);
			}
			if (antiSniping) {
				body.antiSnipingEnabled = true;
				body.antiSnipingMinutes = Number(antiSnipingMinutes);
			}
			updateMutation.mutate({
				params: { id: auction.id },
				body: body as Parameters<typeof updateMutation.mutate>[0]["body"],
			});
		} else {
			if (!productId.trim() || !productName.trim()) {
				setError("Product ID and name are required");
				return;
			}
			if (!startingPrice || Number.parseFloat(startingPrice) <= 0) {
				setError("Starting price must be greater than zero");
				return;
			}

			const body: Record<string, unknown> = {
				title: title.trim(),
				productId: productId.trim(),
				productName: productName.trim(),
				type,
				startingPrice: parseCents(startingPrice),
				startsAt: new Date(startsAt),
				endsAt: new Date(endsAt),
			};
			if (reservePrice) body.reservePrice = parseCents(reservePrice);
			if (buyNowPrice) body.buyNowPrice = parseCents(buyNowPrice);
			if (type === "english" && bidIncrement)
				body.bidIncrement = parseCents(bidIncrement);
			if (type === "dutch") {
				if (!priceDropAmount) {
					setError("Dutch auctions require a price drop amount");
					return;
				}
				if (!priceDropInterval) {
					setError("Dutch auctions require a price drop interval");
					return;
				}
				body.priceDropAmount = parseCents(priceDropAmount);
				body.priceDropIntervalMinutes = Number(priceDropInterval);
			}
			if (antiSniping) {
				body.antiSnipingEnabled = true;
				body.antiSnipingMinutes = Number(antiSnipingMinutes);
			}
			createMutation.mutate({
				body: body as Parameters<typeof createMutation.mutate>[0]["body"],
			});
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-border border-l bg-background shadow-2xl">
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Auction" : "New Auction"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				{/* Body */}
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-6 px-6 py-6"
				>
					{/* Basic info */}
					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Details</h3>
						<div>
							<label htmlFor="af-title" className={labelCls}>
								Title <span className="text-destructive">*</span>
							</label>
							<input
								ref={firstInputRef}
								id="af-title"
								className={inputCls}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Vintage Watch Auction"
							/>
						</div>
						{!isEditing && (
							<>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label htmlFor="af-product-id" className={labelCls}>
											Product ID <span className="text-destructive">*</span>
										</label>
										<input
											id="af-product-id"
											className={inputCls}
											value={productId}
											onChange={(e) => setProductId(e.target.value)}
											placeholder="prod_…"
										/>
									</div>
									<div>
										<label htmlFor="af-product-name" className={labelCls}>
											Product Name <span className="text-destructive">*</span>
										</label>
										<input
											id="af-product-name"
											className={inputCls}
											value={productName}
											onChange={(e) => setProductName(e.target.value)}
											placeholder="Vintage Omega Watch"
										/>
									</div>
								</div>
								<div>
									<label htmlFor="af-type" className={labelCls}>
										Auction Type <span className="text-destructive">*</span>
									</label>
									<select
										id="af-type"
										className={inputCls}
										value={type}
										onChange={(e) =>
											setType(e.target.value as "english" | "dutch" | "sealed")
										}
									>
										<option value="english">English — bids go up</option>
										<option value="dutch">
											Dutch — price drops until sold
										</option>
										<option value="sealed">
											Sealed — blind bids, highest wins
										</option>
									</select>
								</div>
							</>
						)}
					</div>

					{/* Pricing */}
					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Pricing</h3>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="af-starting-price" className={labelCls}>
									Starting Price (USD){" "}
									{!isEditing && <span className="text-destructive">*</span>}
								</label>
								<input
									id="af-starting-price"
									className={inputCls}
									type="number"
									min="0.01"
									step="0.01"
									value={startingPrice}
									onChange={(e) => setStartingPrice(e.target.value)}
									placeholder="0.00"
								/>
							</div>
							<div>
								<label htmlFor="af-reserve-price" className={labelCls}>
									Reserve Price (USD)
								</label>
								<input
									id="af-reserve-price"
									className={inputCls}
									type="number"
									min="0"
									step="0.01"
									value={reservePrice}
									onChange={(e) => setReservePrice(e.target.value)}
									placeholder="Optional"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="af-buy-now-price" className={labelCls}>
									Buy It Now Price (USD)
								</label>
								<input
									id="af-buy-now-price"
									className={inputCls}
									type="number"
									min="0"
									step="0.01"
									value={buyNowPrice}
									onChange={(e) => setBuyNowPrice(e.target.value)}
									placeholder="Optional"
								/>
							</div>
							{(!isEditing
								? type === "english"
								: auction?.type === "english") && (
								<div>
									<label htmlFor="af-bid-increment" className={labelCls}>
										Bid Increment (USD)
									</label>
									<input
										id="af-bid-increment"
										className={inputCls}
										type="number"
										min="0.01"
										step="0.01"
										value={bidIncrement}
										onChange={(e) => setBidIncrement(e.target.value)}
										placeholder="1.00"
									/>
								</div>
							)}
						</div>
						{(!isEditing ? type === "dutch" : auction?.type === "dutch") && (
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label htmlFor="af-price-drop-amount" className={labelCls}>
										Price Drop Amount (USD){" "}
										{!isEditing && <span className="text-destructive">*</span>}
									</label>
									<input
										id="af-price-drop-amount"
										className={inputCls}
										type="number"
										min="0.01"
										step="0.01"
										value={priceDropAmount}
										onChange={(e) => setPriceDropAmount(e.target.value)}
										placeholder="5.00"
									/>
								</div>
								<div>
									<label htmlFor="af-price-drop-interval" className={labelCls}>
										Drop Interval (minutes){" "}
										{!isEditing && <span className="text-destructive">*</span>}
									</label>
									<input
										id="af-price-drop-interval"
										className={inputCls}
										type="number"
										min="1"
										step="1"
										value={priceDropInterval}
										onChange={(e) => setPriceDropInterval(e.target.value)}
										placeholder="15"
									/>
								</div>
							</div>
						)}
					</div>

					{/* Schedule */}
					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Schedule</h3>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="af-starts-at" className={labelCls}>
									Starts At <span className="text-destructive">*</span>
								</label>
								<input
									id="af-starts-at"
									className={inputCls}
									type="datetime-local"
									value={startsAt}
									onChange={(e) => setStartsAt(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="af-ends-at" className={labelCls}>
									Ends At <span className="text-destructive">*</span>
								</label>
								<input
									id="af-ends-at"
									className={inputCls}
									type="datetime-local"
									value={endsAt}
									onChange={(e) => setEndsAt(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{/* Anti-sniping (create only) */}
					{!isEditing && (
						<div className="space-y-3">
							<h3 className="font-medium text-foreground text-sm">Options</h3>
							<label className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={antiSniping}
									onChange={(e) => setAntiSniping(e.target.checked)}
									className="h-4 w-4 rounded border-input accent-primary"
								/>
								<div>
									<span className="text-foreground text-sm">
										Anti-sniping protection
									</span>
									<p className="text-muted-foreground text-xs">
										Extend end time when bids come in near close
									</p>
								</div>
							</label>
							{antiSniping && (
								<div className="ml-7">
									<label htmlFor="af-anti-sniping-minutes" className={labelCls}>
										Extension (minutes)
									</label>
									<input
										id="af-anti-sniping-minutes"
										className={`${inputCls} max-w-32`}
										type="number"
										min="1"
										max="60"
										value={antiSnipingMinutes}
										onChange={(e) => setAntiSnipingMinutes(e.target.value)}
									/>
								</div>
							)}
						</div>
					)}

					{error && (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					)}

					{/* Footer */}
					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{isPending
								? isEditing
									? "Saving…"
									: "Creating…"
								: isEditing
									? "Save Changes"
									: "Create Auction"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<p className="text-muted-foreground text-sm">{label}</p>
			<p className="mt-1 font-semibold text-2xl text-foreground">{value}</p>
		</div>
	);
}

// ─── Table row ────────────────────────────────────────────────────────────────

function AuctionRow({
	auction,
	onEdit,
	onDelete,
	onPublish,
	onClose,
	onCancel,
	isActionPending,
}: {
	auction: AuctionListItem;
	onEdit: () => void;
	onDelete: () => void;
	onPublish: () => void;
	onClose: () => void;
	onCancel: () => void;
	isActionPending: boolean;
}) {
	const canPublish =
		auction.status === "draft" || auction.status === "scheduled";
	const canClose = auction.status === "active";
	const canCancel =
		auction.status === "draft" ||
		auction.status === "scheduled" ||
		auction.status === "active";
	const canEdit = auction.status === "draft" || auction.status === "scheduled";

	return (
		<tr className="group bg-background hover:bg-muted/30">
			<td className="px-4 py-3">
				<a
					href={`/admin/auctions/${auction.id}`}
					className="font-medium text-foreground hover:underline"
				>
					{auction.title}
				</a>
				<p className="text-muted-foreground text-xs">{auction.productName}</p>
			</td>
			<td className="px-4 py-3 text-muted-foreground">
				{TYPE_LABELS[auction.type] ?? auction.type}
			</td>
			<td className="px-4 py-3">
				<span
					className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[auction.status] ?? ""}`}
				>
					{STATUS_LABELS[auction.status] ?? auction.status}
				</span>
			</td>
			<td className="px-4 py-3 text-right font-medium text-foreground">
				{auction.currentBid > 0
					? formatMoney(auction.currentBid)
					: formatMoney(auction.startingPrice)}
			</td>
			<td className="px-4 py-3 text-right text-muted-foreground">
				{auction.bidCount}
			</td>
			<td className="px-4 py-3 text-muted-foreground text-xs">
				{formatDate(auction.endsAt)}
			</td>
			<td className="px-4 py-3">
				<div className="flex items-center justify-end gap-1">
					{canPublish && (
						<button
							type="button"
							onClick={onPublish}
							disabled={isActionPending}
							className="rounded px-2 py-1 text-blue-600 text-xs hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
						>
							Publish
						</button>
					)}
					{canClose && (
						<button
							type="button"
							onClick={onClose}
							disabled={isActionPending}
							className="rounded px-2 py-1 text-amber-600 text-xs hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
						>
							Close
						</button>
					)}
					{canCancel && (
						<button
							type="button"
							onClick={onCancel}
							disabled={isActionPending}
							className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted disabled:opacity-50"
						>
							Cancel
						</button>
					)}
					{canEdit && (
						<button
							type="button"
							onClick={onEdit}
							className="rounded px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
					)}
					<button
						type="button"
						onClick={onDelete}
						className="rounded px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Delete
					</button>
				</div>
			</td>
		</tr>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function AuctionsList() {
	const api = useAuctionsApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [editAuction, setEditAuction] = useState<AuctionListItem | null>(null);
	const [deleteAuction, setDeleteAuction] = useState<AuctionListItem | null>(
		null,
	);
	const [actionError, setActionError] = useState<string | null>(null);

	const anyModalOpen = showCreate || !!editAuction || !!deleteAuction;
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowCreate(false);
				setEditAuction(null);
				setDeleteAuction(null);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const queryInput: Record<string, string> = { take: String(PAGE_SIZE) };
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: listLoading,
		isError: auctionsError,
		refetch: refetchAuctions,
	} = api.list.useQuery(queryInput) as {
		data: { auctions: AuctionListItem[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: SummaryData } | undefined;
	};

	const publishMutation = api.publish.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => setActionError(err.message),
	});

	const closeMutation = api.close.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => setActionError(err.message),
	});

	const cancelMutation = api.cancel.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => setActionError(err.message),
	});

	if (auctionsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load auctions
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAuctions()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const auctions = listData?.auctions ?? [];
	const summary = summaryData?.summary;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-foreground text-xl">Auctions</h1>
					<p className="text-muted-foreground text-sm">
						Manage time-limited product auctions
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
				>
					+ New Auction
				</button>
			</div>

			{/* Stats */}
			{summary && (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<StatCard label="Total" value={summary.totalAuctions} />
					<StatCard label="Active" value={summary.active} />
					<StatCard label="Total Bids" value={summary.totalBids} />
					<StatCard label="Revenue" value={formatMoney(summary.totalRevenue)} />
				</div>
			)}

			{/* Filters */}
			<div className="flex items-center gap-3">
				<label htmlFor="status-filter" className="sr-only">
					Filter by status
				</label>
				<select
					id="status-filter"
					className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
				>
					<option value="">All statuses</option>
					{Object.entries(STATUS_LABELS).map(([v, l]) => (
						<option key={v} value={v}>
							{l}
						</option>
					))}
				</select>
			</div>

			{/* Action error */}
			{actionError && (
				<div
					role="alert"
					className="rounded-md bg-destructive/10 px-4 py-3 text-destructive text-sm"
				>
					{actionError}
					<button
						type="button"
						onClick={() => setActionError(null)}
						className="ml-2 underline"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Table */}
			{listLoading ? (
				<div className="space-y-2">
					{["s1", "s2", "s3", "s4", "s5"].map((k) => (
						<div key={k} className="h-12 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			) : auctions.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-border border-dashed py-16 text-center">
					<p className="font-medium text-foreground">No auctions yet</p>
					<p className="text-muted-foreground text-sm">
						Create your first auction to sell products to the highest bidder.
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
					>
						Create Auction
					</button>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/40">
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Auction
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Type
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-right font-medium text-muted-foreground"
								>
									Current Bid
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-right font-medium text-muted-foreground"
								>
									Bids
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Ends
								</th>
								<th scope="col" className="px-4 py-3" />
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{auctions.map((auction) => (
								<AuctionRow
									key={auction.id}
									auction={auction}
									onEdit={() => setEditAuction(auction)}
									onDelete={() => setDeleteAuction(auction)}
									onPublish={() =>
										publishMutation.mutate({
											params: { id: auction.id },
										})
									}
									onClose={() =>
										closeMutation.mutate({ params: { id: auction.id } })
									}
									onCancel={() =>
										cancelMutation.mutate({
											params: { id: auction.id },
										})
									}
									isActionPending={
										publishMutation.isPending ||
										closeMutation.isPending ||
										cancelMutation.isPending
									}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Create sheet */}
			{showCreate && (
				<AuctionForm
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			)}

			{/* Edit sheet */}
			{editAuction && (
				<AuctionForm
					auction={editAuction}
					onSaved={() => setEditAuction(null)}
					onCancel={() => setEditAuction(null)}
				/>
			)}

			{/* Delete modal */}
			{deleteAuction && (
				<DeleteModal
					auction={deleteAuction}
					onClose={() => setDeleteAuction(null)}
					onSuccess={() => setDeleteAuction(null)}
				/>
			)}
		</div>
	);
}
