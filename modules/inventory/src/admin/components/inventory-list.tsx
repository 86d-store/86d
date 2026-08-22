"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import InventoryListTemplate from "./inventory-list.mdx";

interface InventoryItem {
	id: string;
	productId: string;
	variantId?: string | null;
	locationId?: string | null;
	productName?: string | null;
	variantName?: string | null;
	quantity: number;
	reserved: number;
	available: number;
	lowStockThreshold?: number | null;
	allowBackorder: boolean;
}

interface SetStockForm {
	productId: string;
	variantId: string;
	locationId: string;
	quantity: number;
	lowStockThreshold: string;
	allowBackorder: boolean;
}

interface AdjustForm {
	productId: string;
	variantId: string;
	locationId: string;
	delta: number;
}

const DEFAULT_SET: SetStockForm = {
	productId: "",
	variantId: "",
	locationId: "",
	quantity: 0,
	lowStockThreshold: "",
	allowBackorder: false,
};

const DEFAULT_ADJUST: AdjustForm = {
	productId: "",
	variantId: "",
	locationId: "",
	delta: 0,
};

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useInventoryAdminApi() {
	const client = useModuleClient();
	return {
		listItems: client.module("inventory").admin["/admin/inventory"],
		setStock: client.module("inventory").admin["/admin/inventory/set"],
		adjustStock: client.module("inventory").admin["/admin/inventory/adjust"],
		lowStock: client.module("inventory").admin["/admin/inventory/low-stock"],
	};
}

function stockBadge(item: InventoryItem) {
	if (item.available <= 0 && !item.allowBackorder)
		return (
			<span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800 text-xs dark:bg-red-900/30 dark:text-red-400">
				Out of stock
			</span>
		);
	if (
		item.lowStockThreshold != null &&
		item.available <= item.lowStockThreshold
	)
		return (
			<span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
				Low stock
			</span>
		);
	return (
		<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
			In stock
		</span>
	);
}

function SetStockModal({
	form,
	setForm,
	onSubmit,
	onClose,
	saving,
	error,
}: {
	form: SetStockForm;
	setForm: React.Dispatch<React.SetStateAction<SetStockForm>>;
	onSubmit: (e: React.FormEvent) => void;
	onClose: () => void;
	saving: boolean;
	error: string;
}) {
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
			>
				<h2 className="mb-4 font-semibold text-foreground text-lg">
					Set stock level
				</h2>
				{error && (
					<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
						{error}
					</p>
				)}
				<form onSubmit={onSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="inv-set-productId"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Product ID <span className="text-red-500">*</span>
						</label>
						<input
							ref={firstInputRef}
							id="inv-set-productId"
							required
							value={form.productId}
							onChange={(e) =>
								setForm((f) => ({ ...f, productId: e.target.value }))
							}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label
								htmlFor="inv-set-variantId"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Variant ID
							</label>
							<input
								id="inv-set-variantId"
								value={form.variantId}
								onChange={(e) =>
									setForm((f) => ({ ...f, variantId: e.target.value }))
								}
								placeholder="optional"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label
								htmlFor="inv-set-locationId"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Location ID
							</label>
							<input
								id="inv-set-locationId"
								value={form.locationId}
								onChange={(e) =>
									setForm((f) => ({ ...f, locationId: e.target.value }))
								}
								placeholder="optional"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label
								htmlFor="inv-set-quantity"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Quantity <span className="text-red-500">*</span>
							</label>
							<input
								id="inv-set-quantity"
								required
								type="number"
								min={0}
								value={form.quantity}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										quantity: Number(e.target.value),
									}))
								}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label
								htmlFor="inv-set-threshold"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Low stock threshold
							</label>
							<input
								id="inv-set-threshold"
								type="number"
								min={0}
								value={form.lowStockThreshold}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										lowStockThreshold: e.target.value,
									}))
								}
								placeholder="optional"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>
					<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
						<input
							type="checkbox"
							checked={form.allowBackorder}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									allowBackorder: e.target.checked,
								}))
							}
							className="rounded"
						/>
						Allow backorders
					</label>
					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving}
							className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function AdjustStockModal({
	form,
	setForm,
	onSubmit,
	onClose,
	saving,
	error,
}: {
	form: AdjustForm;
	setForm: React.Dispatch<React.SetStateAction<AdjustForm>>;
	onSubmit: (e: React.FormEvent) => void;
	onClose: () => void;
	saving: boolean;
	error: string;
}) {
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl"
			>
				<h2 className="mb-1 font-semibold text-foreground text-lg">
					Adjust stock
				</h2>
				<p className="mb-4 text-muted-foreground text-sm">
					Positive delta = restock. Negative delta = shrinkage/loss.
				</p>
				{error && (
					<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
						{error}
					</p>
				)}
				<form onSubmit={onSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="inv-adj-productId"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Product ID <span className="text-red-500">*</span>
						</label>
						<input
							ref={firstInputRef}
							id="inv-adj-productId"
							required
							value={form.productId}
							onChange={(e) =>
								setForm((f) => ({ ...f, productId: e.target.value }))
							}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label
								htmlFor="inv-adj-variantId"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Variant ID
							</label>
							<input
								id="inv-adj-variantId"
								value={form.variantId}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										variantId: e.target.value,
									}))
								}
								placeholder="optional"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label
								htmlFor="inv-adj-locationId"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Location ID
							</label>
							<input
								id="inv-adj-locationId"
								value={form.locationId}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										locationId: e.target.value,
									}))
								}
								placeholder="optional"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor="inv-adj-delta"
							className="mb-1 block font-medium text-foreground text-sm"
						>
							Delta <span className="text-red-500">*</span>
						</label>
						<input
							id="inv-adj-delta"
							required
							type="number"
							value={form.delta}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									delta: Number(e.target.value),
								}))
							}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving}
							className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{saving ? "Saving…" : "Apply"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function InventoryList() {
	const api = useInventoryAdminApi();
	const adjustSubmission = useRef<
		{ fingerprint: string; idempotencyKey: string } | undefined
	>(undefined);
	const [lowStockOnly, setLowStockOnly] = useState(false);
	const [productFilter, setProductFilter] = useState("");

	const [showSet, setShowSet] = useState(false);
	const [showAdjust, setShowAdjust] = useState(false);
	const [setForm, setSetForm] = useState<SetStockForm>(DEFAULT_SET);
	const [adjustForm, setAdjustForm] = useState<AdjustForm>(DEFAULT_ADJUST);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const anyModalOpen = showSet || showAdjust;
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowSet(false);
				setShowAdjust(false);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const listQueryInput = productFilter
		? { take: "100", productId: productFilter }
		: { take: "100" };

	const { data: listData, isLoading: listLoading } = api.listItems.useQuery(
		listQueryInput,
		{ enabled: !lowStockOnly },
	) as {
		data: { items: InventoryItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: lowStockData, isLoading: lowStockLoading } =
		api.lowStock.useQuery(undefined, {
			enabled: lowStockOnly,
		}) as {
			data: { items: InventoryItem[] } | undefined;
			isLoading: boolean;
		};

	const loading = lowStockOnly ? lowStockLoading : listLoading;
	const items = lowStockOnly
		? (lowStockData?.items ?? [])
		: (listData?.items ?? []);

	const setStockMutation = api.setStock.useMutation({
		onSuccess: () => {
			setShowSet(false);
			setSetForm(DEFAULT_SET);
			void api.listItems.invalidate();
			void api.lowStock.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to set stock"));
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	const adjustStockMutation = api.adjustStock.useMutation({
		onSuccess: () => {
			adjustSubmission.current = undefined;
			setShowAdjust(false);
			setAdjustForm(DEFAULT_ADJUST);
			void api.listItems.invalidate();
			void api.lowStock.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to adjust stock"));
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	function openSetFor(item: InventoryItem) {
		setSetForm({
			productId: item.productId,
			variantId: item.variantId ?? "",
			locationId: item.locationId ?? "",
			quantity: item.quantity,
			lowStockThreshold:
				item.lowStockThreshold != null ? String(item.lowStockThreshold) : "",
			allowBackorder: item.allowBackorder,
		});
		setShowSet(true);
	}

	function openAdjustFor(item: InventoryItem) {
		adjustSubmission.current = undefined;
		setAdjustForm({
			productId: item.productId,
			variantId: item.variantId ?? "",
			locationId: item.locationId ?? "",
			delta: 0,
		});
		setShowAdjust(true);
	}

	function handleSetStock(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		const body = {
			productId: setForm.productId,
			quantity: setForm.quantity,
			allowBackorder: setForm.allowBackorder,
			...(setForm.variantId ? { variantId: setForm.variantId } : {}),
			...(setForm.locationId ? { locationId: setForm.locationId } : {}),
			...(setForm.lowStockThreshold !== ""
				? { lowStockThreshold: Number(setForm.lowStockThreshold) }
				: {}),
		};
		setStockMutation.mutate(body);
	}

	function handleAdjust(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		const adjustment = {
			productId: adjustForm.productId,
			delta: adjustForm.delta,
			...(adjustForm.variantId ? { variantId: adjustForm.variantId } : {}),
			...(adjustForm.locationId ? { locationId: adjustForm.locationId } : {}),
		};
		const fingerprint = JSON.stringify(adjustment);
		const idempotencyKey =
			adjustSubmission.current?.fingerprint === fingerprint
				? adjustSubmission.current.idempotencyKey
				: crypto.randomUUID();
		adjustSubmission.current = { fingerprint, idempotencyKey };
		adjustStockMutation.mutate({ ...adjustment, idempotencyKey });
	}

	const subtitle = `${items.length} item${items.length !== 1 ? "s" : ""}`;

	const tableBody = loading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
			<tr key={rowKey}>
				{(["k0", "k1", "k2", "k3", "k4", "k5", "k6"] as const).map((_key) => (
					<td key={cellKey} className="px-4 py-3">
						<div className="h-4 w-20 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : items.length === 0 ? (
		<tr>
			<td colSpan={7} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No inventory records
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Set stock levels for your products to start tracking inventory
				</p>
			</td>
		</tr>
	) : (
		items.map((item) => (
			<tr key={item.id} className="transition-colors hover:bg-muted/30">
				<td className="max-w-[200px] truncate px-4 py-3 font-medium text-foreground text-sm">
					<span className="block truncate">
						{item.productName ?? item.productId}
					</span>
					{item.productName && (
						<span className="block truncate font-mono text-muted-foreground text-xs">
							{item.productId}
						</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
					{(item.variantName ?? item.variantId) && (
						<span className="mr-2">{item.variantName ?? item.variantId}</span>
					)}
					{item.locationId && (
						<span className="text-xs">{item.locationId}</span>
					)}
					{!item.variantId && !item.locationId && (
						<span className="text-muted-foreground/50">—</span>
					)}
				</td>
				<td className="px-4 py-3 text-right text-foreground text-sm tabular-nums">
					{item.quantity}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-sm tabular-nums md:table-cell">
					{item.reserved}
				</td>
				<td className="px-4 py-3 text-right font-medium text-foreground text-sm tabular-nums">
					{item.available}
				</td>
				<td className="hidden px-4 py-3 lg:table-cell">{stockBadge(item)}</td>
				<td className="px-4 py-3 text-right">
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={() => openAdjustFor(item)}
							className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
						>
							Adjust
						</button>
						<button
							type="button"
							onClick={() => openSetFor(item)}
							className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
						>
							Set
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<InventoryListTemplate
			subtitle={subtitle}
			onSetStockClick={() => {
				setSetForm(DEFAULT_SET);
				setShowSet(true);
			}}
			productFilter={productFilter}
			onProductFilterChange={setProductFilter}
			lowStockOnly={lowStockOnly}
			onLowStockOnlyChange={setLowStockOnly}
			tableBody={tableBody}
			setStockModal={
				showSet ? (
					<SetStockModal
						form={setForm}
						setForm={setSetForm}
						onSubmit={handleSetStock}
						onClose={() => setShowSet(false)}
						saving={saving}
						error={error}
					/>
				) : null
			}
			adjustStockModal={
				showAdjust ? (
					<AdjustStockModal
						form={adjustForm}
						setForm={setAdjustForm}
						onSubmit={handleAdjust}
						onClose={() => setShowAdjust(false)}
						saving={saving}
						error={error}
					/>
				) : null
			}
		/>
	);
}
