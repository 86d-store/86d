"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuctionData {
	id: string;
	title: string;
	description?: string;
	productName: string;
	productId: string;
	imageUrl?: string;
	type: "english" | "dutch" | "sealed";
	status: "draft" | "scheduled" | "active" | "ended" | "sold" | "cancelled";
	startingPrice: number;
	currentBid: number;
	reservePrice?: number;
	buyNowPrice?: number;
	bidIncrement?: number;
	priceDropAmount?: number;
	priceDropIntervalMinutes?: number;
	bidCount: number;
	startsAt: string;
	endsAt: string;
}

interface BidData {
	id: string;
	customerId: string;
	customerName?: string;
	amount: number;
	isWinning: boolean;
	createdAt: string;
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
	english: "English (ascending)",
	dutch: "Dutch (descending)",
	sealed: "Sealed (blind bids)",
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

function useAuctionDetailApi() {
	const client = useModuleClient();
	return {
		detail: client.module("auctions").admin["/admin/auctions/:id"],
		bids: client.module("auctions").admin["/admin/auctions/:id/bids"],
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
	onDeleted,
}: {
	auction: AuctionData;
	onClose: () => void;
	onDeleted: () => void;
}) {
	const api = useAuctionDetailApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.remove.useMutation({
		onSuccess: () => onDeleted(),
	});

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

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

// ─── Edit sheet ───────────────────────────────────────────────────────────────

function EditSheet({
	auction,
	onSaved,
	onCancel,
}: {
	auction: AuctionData;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useAuctionDetailApi();

	const [title, setTitle] = useState(auction.title);
	const [startingPrice, setStartingPrice] = useState(
		String((auction.startingPrice / 100).toFixed(2)),
	);
	const [reservePrice, setReservePrice] = useState(
		auction.reservePrice ? String((auction.reservePrice / 100).toFixed(2)) : "",
	);
	const [buyNowPrice, setBuyNowPrice] = useState(
		auction.buyNowPrice ? String((auction.buyNowPrice / 100).toFixed(2)) : "",
	);
	const [bidIncrement, setBidIncrement] = useState(
		auction.bidIncrement ? String((auction.bidIncrement / 100).toFixed(2)) : "",
	);
	const [priceDropAmount, setPriceDropAmount] = useState(
		auction.priceDropAmount
			? String((auction.priceDropAmount / 100).toFixed(2))
			: "",
	);
	const [priceDropInterval, setPriceDropInterval] = useState(
		auction.priceDropIntervalMinutes
			? String(auction.priceDropIntervalMinutes)
			: "",
	);
	const [startsAt, setStartsAt] = useState(toDatetimeLocal(auction.startsAt));
	const [endsAt, setEndsAt] = useState(toDatetimeLocal(auction.endsAt));
	const [error, setError] = useState("");

	const parseCents = (val: string) => Math.round(Number.parseFloat(val) * 100);

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ params: { id: auction.id } });
			onSaved();
		},
		onError: (err: Error) => setError(err.message ?? "Failed to update"),
	});

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (!title.trim()) {
			setError("Title is required");
			return;
		}

		const body: Record<string, unknown> = {
			title: title.trim(),
			startsAt: new Date(startsAt),
			endsAt: new Date(endsAt),
		};
		if (startingPrice) body.startingPrice = parseCents(startingPrice);
		if (reservePrice) body.reservePrice = parseCents(reservePrice);
		if (buyNowPrice) body.buyNowPrice = parseCents(buyNowPrice);
		if (auction.type === "english" && bidIncrement)
			body.bidIncrement = parseCents(bidIncrement);
		if (auction.type === "dutch") {
			if (priceDropAmount) body.priceDropAmount = parseCents(priceDropAmount);
			if (priceDropInterval)
				body.priceDropIntervalMinutes = Number(priceDropInterval);
		}

		updateMutation.mutate({
			params: { id: auction.id },
			body: body as Parameters<typeof updateMutation.mutate>[0]["body"],
		});
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
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						Edit Auction
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
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-6 px-6 py-6"
				>
					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Details</h3>
						<div>
							<label htmlFor="es-title" className={labelCls}>
								Title
							</label>
							<input
								id="es-title"
								className={inputCls}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Pricing</h3>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="es-starting-price" className={labelCls}>
									Starting Price (USD)
								</label>
								<input
									id="es-starting-price"
									className={inputCls}
									type="number"
									min="0.01"
									step="0.01"
									value={startingPrice}
									onChange={(e) => setStartingPrice(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="es-reserve-price" className={labelCls}>
									Reserve Price (USD)
								</label>
								<input
									id="es-reserve-price"
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
								<label htmlFor="es-buy-now-price" className={labelCls}>
									Buy It Now Price (USD)
								</label>
								<input
									id="es-buy-now-price"
									className={inputCls}
									type="number"
									min="0"
									step="0.01"
									value={buyNowPrice}
									onChange={(e) => setBuyNowPrice(e.target.value)}
									placeholder="Optional"
								/>
							</div>
							{auction.type === "english" && (
								<div>
									<label htmlFor="es-bid-increment" className={labelCls}>
										Bid Increment (USD)
									</label>
									<input
										id="es-bid-increment"
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
						{auction.type === "dutch" && (
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label htmlFor="es-price-drop-amount" className={labelCls}>
										Price Drop Amount (USD)
									</label>
									<input
										id="es-price-drop-amount"
										className={inputCls}
										type="number"
										min="0.01"
										step="0.01"
										value={priceDropAmount}
										onChange={(e) => setPriceDropAmount(e.target.value)}
									/>
								</div>
								<div>
									<label htmlFor="es-price-drop-interval" className={labelCls}>
										Drop Interval (minutes)
									</label>
									<input
										id="es-price-drop-interval"
										className={inputCls}
										type="number"
										min="1"
										value={priceDropInterval}
										onChange={(e) => setPriceDropInterval(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-4">
						<h3 className="font-medium text-foreground text-sm">Schedule</h3>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="es-starts-at" className={labelCls}>
									Starts At
								</label>
								<input
									id="es-starts-at"
									className={inputCls}
									type="datetime-local"
									value={startsAt}
									onChange={(e) => setStartsAt(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="es-ends-at" className={labelCls}>
									Ends At
								</label>
								<input
									id="es-ends-at"
									className={inputCls}
									type="datetime-local"
									value={endsAt}
									onChange={(e) => setEndsAt(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{error && (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					)}

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
							disabled={updateMutation.isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{updateMutation.isPending ? "Saving…" : "Save Changes"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Detail item ──────────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-0.5 font-medium text-foreground text-sm">{value}</p>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuctionDetail({ auctionId }: { auctionId: string }) {
	const api = useAuctionDetailApi();
	const [showEdit, setShowEdit] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const { data, isLoading } = api.detail.useQuery({
		params: { id: auctionId },
	}) as {
		data:
			| { auction: AuctionData; recentBids: BidData[]; watcherCount: number }
			| undefined;
		isLoading: boolean;
	};

	const { data: bidsData } = api.bids.useQuery({
		params: { id: auctionId },
		query: { take: 50 },
	}) as { data: { bids: BidData[] } | undefined };

	const publishMutation = api.publish.useMutation({
		onSuccess: () => void api.detail.invalidate({ params: { id: auctionId } }),
		onError: (err: Error) => setActionError(err.message),
	});

	const closeMutation = api.close.useMutation({
		onSuccess: () => void api.detail.invalidate({ params: { id: auctionId } }),
		onError: (err: Error) => setActionError(err.message),
	});

	const cancelMutation = api.cancel.useMutation({
		onSuccess: () => void api.detail.invalidate({ params: { id: auctionId } }),
		onError: (err: Error) => setActionError(err.message),
	});

	const isActionPending =
		publishMutation.isPending ||
		closeMutation.isPending ||
		cancelMutation.isPending;

	if (isLoading) {
		return (
			<div className="space-y-4">
				{["s1", "s2", "s3", "s4"].map((k) => (
					<div key={k} className="h-16 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	if (!data?.auction) {
		return (
			<div className="rounded-lg border border-border py-16 text-center text-muted-foreground">
				Auction not found
			</div>
		);
	}

	const auction = data.auction;
	const bids = bidsData?.bids ?? data.recentBids ?? [];
	const canPublish =
		auction.status === "draft" || auction.status === "scheduled";
	const canClose = auction.status === "active";
	const canCancel =
		auction.status === "draft" ||
		auction.status === "scheduled" ||
		auction.status === "active";
	const canEdit = auction.status === "draft" || auction.status === "scheduled";

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-semibold text-foreground text-xl">
							{auction.title}
						</h1>
						<span
							className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[auction.status] ?? ""}`}
						>
							{STATUS_LABELS[auction.status] ?? auction.status}
						</span>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{auction.productName} · {TYPE_LABELS[auction.type] ?? auction.type}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{canPublish && (
						<button
							type="button"
							onClick={() =>
								publishMutation.mutate({ params: { id: auctionId } })
							}
							disabled={isActionPending}
							className="rounded-md bg-blue-600 px-3 py-2 font-medium text-sm text-white hover:bg-blue-700 disabled:opacity-50"
						>
							Publish
						</button>
					)}
					{canClose && (
						<button
							type="button"
							onClick={() =>
								closeMutation.mutate({ params: { id: auctionId } })
							}
							disabled={isActionPending}
							className="rounded-md bg-amber-500 px-3 py-2 font-medium text-sm text-white hover:bg-amber-600 disabled:opacity-50"
						>
							Close Auction
						</button>
					)}
					{canCancel && (
						<button
							type="button"
							onClick={() =>
								cancelMutation.mutate({ params: { id: auctionId } })
							}
							disabled={isActionPending}
							className="rounded-md border border-border px-3 py-2 text-muted-foreground text-sm hover:bg-muted disabled:opacity-50"
						>
							Cancel
						</button>
					)}
					{canEdit && (
						<button
							type="button"
							onClick={() => setShowEdit(true)}
							className="rounded-md border border-border px-3 py-2 text-foreground text-sm hover:bg-muted"
						>
							Edit
						</button>
					)}
					<button
						type="button"
						onClick={() => setShowDelete(true)}
						className="rounded-md border border-destructive/30 px-3 py-2 text-destructive text-sm hover:bg-destructive/10"
					>
						Delete
					</button>
				</div>
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

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-sm">Current Bid</p>
					<p className="mt-1 font-semibold text-2xl text-foreground">
						{auction.currentBid > 0
							? formatMoney(auction.currentBid)
							: formatMoney(auction.startingPrice)}
					</p>
					<p className="text-muted-foreground text-xs">
						Starting: {formatMoney(auction.startingPrice)}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-sm">Total Bids</p>
					<p className="mt-1 font-semibold text-2xl text-foreground">
						{auction.bidCount}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-sm">Watchers</p>
					<p className="mt-1 font-semibold text-2xl text-foreground">
						{data.watcherCount}
					</p>
				</div>
			</div>

			{/* Details */}
			<div className="rounded-xl border border-border bg-card">
				<div className="border-border border-b px-5 py-4">
					<h2 className="font-medium text-foreground text-sm">
						Auction Details
					</h2>
				</div>
				<div className="grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-3">
					<DetailItem
						label="Type"
						value={TYPE_LABELS[auction.type] ?? auction.type}
					/>
					<DetailItem
						label="Reserve Price"
						value={
							auction.reservePrice ? formatMoney(auction.reservePrice) : "—"
						}
					/>
					<DetailItem
						label="Buy It Now"
						value={auction.buyNowPrice ? formatMoney(auction.buyNowPrice) : "—"}
					/>
					{auction.type === "english" && (
						<DetailItem
							label="Bid Increment"
							value={
								auction.bidIncrement ? formatMoney(auction.bidIncrement) : "—"
							}
						/>
					)}
					{auction.type === "dutch" && (
						<>
							<DetailItem
								label="Price Drop"
								value={
									auction.priceDropAmount
										? formatMoney(auction.priceDropAmount)
										: "—"
								}
							/>
							<DetailItem
								label="Drop Interval"
								value={
									auction.priceDropIntervalMinutes
										? `${auction.priceDropIntervalMinutes} min`
										: "—"
								}
							/>
						</>
					)}
					<DetailItem label="Starts" value={formatDate(auction.startsAt)} />
					<DetailItem label="Ends" value={formatDate(auction.endsAt)} />
				</div>
				{auction.description && (
					<div className="border-border border-t px-5 py-4">
						<p className="text-muted-foreground text-sm">
							{auction.description}
						</p>
					</div>
				)}
			</div>

			{/* Bids */}
			<div className="rounded-xl border border-border bg-card">
				<div className="border-border border-b px-5 py-4">
					<h2 className="font-medium text-foreground text-sm">
						Bids ({bids.length})
					</h2>
				</div>
				{bids.length === 0 ? (
					<div className="py-10 text-center text-muted-foreground text-sm">
						No bids yet
					</div>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/40">
								<th
									scope="col"
									className="px-5 py-3 text-left font-medium text-muted-foreground"
								>
									Bidder
								</th>
								<th
									scope="col"
									className="px-5 py-3 text-right font-medium text-muted-foreground"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-5 py-3 text-left font-medium text-muted-foreground"
								>
									Time
								</th>
								<th
									scope="col"
									className="px-5 py-3 text-left font-medium text-muted-foreground"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{bids.map((bid) => (
								<tr key={bid.id} className="bg-background">
									<td className="px-5 py-3 text-foreground">
										{bid.customerName ?? `${bid.customerId.slice(0, 12)}…`}
									</td>
									<td className="px-5 py-3 text-right font-medium text-foreground">
										{formatMoney(bid.amount)}
									</td>
									<td className="px-5 py-3 text-muted-foreground text-xs">
										{formatDate(bid.createdAt)}
									</td>
									<td className="px-5 py-3">
										{bid.isWinning && (
											<span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 text-xs dark:bg-emerald-900/30 dark:text-emerald-400">
												Winning
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{/* Edit sheet */}
			{showEdit && (
				<EditSheet
					auction={auction}
					onSaved={() => setShowEdit(false)}
					onCancel={() => setShowEdit(false)}
				/>
			)}

			{/* Delete modal */}
			{showDelete && (
				<DeleteModal
					auction={auction}
					onClose={() => setShowDelete(false)}
					onDeleted={() => {
						setShowDelete(false);
						window.history.back();
					}}
				/>
			)}
		</div>
	);
}
