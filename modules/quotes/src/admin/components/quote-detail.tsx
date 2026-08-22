"use client";

import { useState } from "react";
import {
	extractError,
	formatCurrency,
	inputCls,
	labelCls,
	type Quote,
	STATUS_COLORS,
	useQuotesApi,
} from "./_shared";

interface QuoteItem {
	id: string;
	productName?: string;
	sku?: string;
	quantity: number;
	unitPrice: number;
	offeredPrice?: number;
	notes?: string;
}

interface QuoteComment {
	id: string;
	authorType: "customer" | "admin";
	authorName?: string;
	message: string;
	createdAt: string;
}

interface QuoteHistory {
	id: string;
	fromStatus?: string;
	toStatus: string;
	changedBy?: string;
	reason?: string;
	createdAt: string;
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function AddItemForm({ quoteId, onSaved, onCancel }: AddItemFormProps) {
	const api = useQuotesApi();
	const [productName, setProductName] = useState("");
	const [productId, setProductId] = useState("");
	const [sku, setSku] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [unitPrice, setUnitPrice] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState("");

	const addItemMutation = api.addItem.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id: quoteId });
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!productName.trim()) {
			setError("Product name is required.");
			return;
		}
		const unitPriceCents = Math.round(
			Number.parseFloat(unitPrice || "0") * 100,
		);
		if (unitPriceCents < 0 || Number.isNaN(unitPriceCents)) {
			setError("Unit price must be a valid number.");
			return;
		}
		const qty = Number.parseInt(quantity, 10);
		if (!qty || qty < 1) {
			setError("Quantity must be at least 1.");
			return;
		}
		const body: Record<string, unknown> = {
			productId: productId.trim() || crypto.randomUUID(),
			productName: productName.trim(),
			quantity: qty,
			unitPrice: unitPriceCents,
		};
		if (sku.trim()) body.sku = sku.trim();
		if (notes.trim()) body.notes = notes.trim();
		addItemMutation.mutate({ params: { id: quoteId }, body });
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="mt-3 rounded-lg border border-border bg-muted/30 p-4"
		>
			{error ? (
				<div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-red-800 text-xs dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="sm:col-span-2">
					<label htmlFor="ai-name" className={labelCls}>
						Product name <span className="text-red-500">*</span>
					</label>
					<input
						id="ai-name"
						type="text"
						value={productName}
						onChange={(e) => setProductName(e.target.value)}
						className={inputCls}
						placeholder="Widget Pro"
						required
					/>
				</div>
				<div>
					<label htmlFor="ai-sku" className={labelCls}>
						SKU
					</label>
					<input
						id="ai-sku"
						type="text"
						value={sku}
						onChange={(e) => setSku(e.target.value)}
						className={inputCls}
						placeholder="WGT-001"
					/>
				</div>
				<div>
					<label htmlFor="ai-productId" className={labelCls}>
						Product ID
					</label>
					<input
						id="ai-productId"
						type="text"
						value={productId}
						onChange={(e) => setProductId(e.target.value)}
						className={inputCls}
						placeholder="(auto-generated)"
					/>
				</div>
				<div>
					<label htmlFor="ai-qty" className={labelCls}>
						Quantity <span className="text-red-500">*</span>
					</label>
					<input
						id="ai-qty"
						type="number"
						min="1"
						step="1"
						value={quantity}
						onChange={(e) => setQuantity(e.target.value)}
						className={inputCls}
						required
					/>
				</div>
				<div>
					<label htmlFor="ai-price" className={labelCls}>
						Unit price (USD)
					</label>
					<input
						id="ai-price"
						type="number"
						min="0"
						step="0.01"
						value={unitPrice}
						onChange={(e) => setUnitPrice(e.target.value)}
						className={inputCls}
						placeholder="0.00"
					/>
				</div>
				<div className="sm:col-span-2">
					<label htmlFor="ai-notes" className={labelCls}>
						Notes
					</label>
					<input
						id="ai-notes"
						type="text"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						className={inputCls}
						placeholder="Optional item notes"
					/>
				</div>
			</div>
			<div className="mt-3 flex gap-2">
				<button
					type="submit"
					disabled={addItemMutation.isPending}
					className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{addItemMutation.isPending ? "Adding…" : "Add Item"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function EditItemRow({
	quoteId,
	item,
	currency,
	onSaved,
	onCancel,
}: EditItemRowProps) {
	const api = useQuotesApi();
	const [quantity, setQuantity] = useState(String(item.quantity));
	const [unitPrice, setUnitPrice] = useState(
		String((item.unitPrice / 100).toFixed(2)),
	);
	const [notes, setNotes] = useState(item.notes ?? "");
	const [error, setError] = useState("");

	const updateMutation = api.updateItem.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id: quoteId });
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSave() {
		setError("");
		const qty = Number.parseInt(quantity, 10);
		if (!qty || qty < 1) {
			setError("Quantity must be at least 1.");
			return;
		}
		const unitPriceCents = Math.round(
			Number.parseFloat(unitPrice || "0") * 100,
		);
		if (unitPriceCents < 0 || Number.isNaN(unitPriceCents)) {
			setError("Unit price must be a valid number.");
			return;
		}
		const body: Record<string, unknown> = {
			quantity: qty,
			unitPrice: unitPriceCents,
		};
		if (notes.trim() !== (item.notes ?? "")) body.notes = notes.trim();
		updateMutation.mutate({
			params: { id: quoteId, itemId: item.id },
			body,
		});
	}

	return (
		<tr>
			<td colSpan={4} className="px-4 py-3">
				{error ? (
					<div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-red-800 text-xs dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
						{error}
					</div>
				) : null}
				<div className="grid gap-2 sm:grid-cols-4">
					<div className="sm:col-span-2">
						<p className="mb-1 font-medium text-foreground text-sm">
							{item.productName ?? "Product"}
						</p>
						{item.sku ? (
							<p className="text-muted-foreground text-xs">SKU: {item.sku}</p>
						) : null}
					</div>
					<div>
						<label
							htmlFor={`ei-qty-${item.id}`}
							className="mb-1 block text-muted-foreground text-xs"
						>
							Qty
						</label>
						<input
							id={`ei-qty-${item.id}`}
							type="number"
							min="1"
							step="1"
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div>
						<label
							htmlFor={`ei-price-${item.id}`}
							className="mb-1 block text-muted-foreground text-xs"
						>
							Unit price ({currency})
						</label>
						<input
							id={`ei-price-${item.id}`}
							type="number"
							min="0"
							step="0.01"
							value={unitPrice}
							onChange={(e) => setUnitPrice(e.target.value)}
							className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>
				<div className="mt-2">
					<label
						htmlFor={`ei-notes-${item.id}`}
						className="mb-1 block text-muted-foreground text-xs"
					>
						Notes
					</label>
					<input
						id={`ei-notes-${item.id}`}
						type="text"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						placeholder="Optional notes"
					/>
				</div>
				<div className="mt-2 flex gap-2">
					<button
						type="button"
						onClick={handleSave}
						disabled={updateMutation.isPending}
						className="rounded bg-foreground px-3 py-1 font-medium text-background text-xs hover:opacity-90 disabled:opacity-50"
					>
						{updateMutation.isPending ? "Saving…" : "Save"}
					</button>
					<button
						type="button"
						onClick={onCancel}
						className="rounded border border-border px-3 py-1 font-medium text-foreground text-xs hover:bg-muted"
					>
						Cancel
					</button>
				</div>
			</td>
		</tr>
	);
}

interface EditItemRowProps {
	quoteId: string;
	item: QuoteItem;
	currency: string;
	onSaved: () => void;
	onCancel: () => void;
}

interface AddItemFormProps {
	quoteId: string;
	onSaved: () => void;
	onCancel: () => void;
}

export function QuoteDetail({ params }: { params?: Record<string, string> }) {
	const id = params?.id ?? "";
	const api = useQuotesApi();
	const [comment, setComment] = useState("");
	const [error, setError] = useState("");
	const [showConvertForm, setShowConvertForm] = useState(false);
	const [convertOrderId, setConvertOrderId] = useState("");
	const [showAddItem, setShowAddItem] = useState(false);
	const [editingItemId, setEditingItemId] = useState<string | null>(null);

	const approveMutation = api.approve.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id });
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as {
		mutate: (o: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => void;
		isPending: boolean;
	};

	const rejectMutation = api.reject.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id });
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as {
		mutate: (o: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => void;
		isPending: boolean;
	};

	const convertMutation = api.convert.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id });
			setShowConvertForm(false);
			setConvertOrderId("");
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as {
		mutate: (o: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => void;
		isPending: boolean;
	};

	const addCommentMutation = api.addComment.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id });
			setComment("");
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as {
		mutate: (o: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => void;
		isPending: boolean;
	};

	const deleteMutation = api.deleteQuote.useMutation({
		onSuccess: () => {
			window.location.assign("/admin/quotes");
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as { mutate: (o: { params: { id: string } }) => void; isPending: boolean };

	const removeItemMutation = api.removeItem.useMutation({
		onSuccess: () => {
			void api.detail.invalidate({ id });
		},
		onError: (err: Error) => setError(extractError(err)),
	}) as {
		mutate: (o: { params: { id: string; itemId: string } }) => void;
		isPending: boolean;
	};

	const { data, isLoading } = api.detail.useQuery({ id }) as {
		data:
			| {
					quote?: Quote;
					items?: QuoteItem[];
					comments?: QuoteComment[];
					history?: QuoteHistory[];
			  }
			| undefined;
		isLoading: boolean;
	};

	const quote = data?.quote;
	const items = data?.items ?? [];
	const comments = data?.comments ?? [];
	const history = data?.history ?? [];

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/quotes"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Quotes
					</a>
				</div>
				<div className="space-y-4">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</div>
		);
	}

	if (!quote) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/quotes"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Quotes
					</a>
				</div>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Quote not found.</p>
				</div>
			</div>
		);
	}

	const isDraft = quote.status === "draft";
	const canApprove = ["submitted", "under_review"].includes(quote.status);
	const canReject = ["submitted", "under_review", "countered"].includes(
		quote.status,
	);
	const canConvert = quote.status === "accepted";
	const isTerminal = ["rejected", "expired", "converted"].includes(
		quote.status,
	);

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/quotes"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to Quotes
				</a>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}

			{/* Header */}
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-bold text-2xl text-foreground">
							Quote {quote.quoteNumber ? `#${quote.quoteNumber}` : ""}
						</h1>
						<span
							className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs capitalize ${STATUS_COLORS[quote.status] ?? "bg-muted text-muted-foreground"}`}
						>
							{quote.status.replace(/_/g, " ")}
						</span>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						Created {formatDate(quote.createdAt)}
						{quote.expiresAt ? ` · Expires ${formatDate(quote.expiresAt)}` : ""}
					</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<div className="flex flex-wrap gap-2">
						{canApprove ? (
							<button
								type="button"
								onClick={() =>
									approveMutation.mutate({ params: { id }, body: {} })
								}
								disabled={approveMutation.isPending}
								className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-green-700 disabled:opacity-50"
							>
								{approveMutation.isPending ? "Approving…" : "Approve"}
							</button>
						) : null}
						{canConvert ? (
							<button
								type="button"
								onClick={() => setShowConvertForm((v) => !v)}
								disabled={convertMutation.isPending}
								className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
							>
								Convert to Order
							</button>
						) : null}
						{canReject ? (
							<button
								type="button"
								onClick={() =>
									rejectMutation.mutate({ params: { id }, body: {} })
								}
								disabled={rejectMutation.isPending}
								className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-muted disabled:opacity-50"
							>
								{rejectMutation.isPending ? "Rejecting…" : "Reject"}
							</button>
						) : null}
						{isTerminal ? (
							<button
								type="button"
								onClick={() => {
									if (
										window.confirm(
											"Permanently delete this quote? This cannot be undone.",
										)
									) {
										deleteMutation.mutate({ params: { id } });
									}
								}}
								disabled={deleteMutation.isPending}
								className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:hover:bg-red-900/40"
							>
								{deleteMutation.isPending ? "Deleting…" : "Delete"}
							</button>
						) : null}
					</div>
					{showConvertForm ? (
						<div className="flex gap-2">
							<input
								type="text"
								value={convertOrderId}
								onChange={(e) => setConvertOrderId(e.target.value)}
								placeholder="Order ID"
								className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<button
								type="button"
								onClick={() =>
									convertMutation.mutate({
										params: { id },
										body: { orderId: convertOrderId.trim() },
									})
								}
								disabled={!convertOrderId.trim() || convertMutation.isPending}
								className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
							>
								{convertMutation.isPending ? "Converting…" : "Confirm"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowConvertForm(false);
									setConvertOrderId("");
								}}
								className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
							>
								Cancel
							</button>
						</div>
					) : null}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Left column */}
				<div className="space-y-6 lg:col-span-2">
					{/* Items table */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Items ({items.length})
							</h2>
							{isDraft ? (
								<button
									type="button"
									onClick={() => {
										setShowAddItem((v) => !v);
										setEditingItemId(null);
									}}
									className="rounded-md border border-border px-2.5 py-1 text-foreground text-xs hover:bg-muted"
								>
									{showAddItem ? "Cancel" : "+ Add Item"}
								</button>
							) : null}
						</div>

						{showAddItem && isDraft ? (
							<div className="px-4 pb-2">
								<AddItemForm
									quoteId={id}
									onSaved={() => setShowAddItem(false)}
									onCancel={() => setShowAddItem(false)}
								/>
							</div>
						) : null}

						{items.length === 0 && !showAddItem ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								No items in this quote.
								{isDraft ? (
									<button
										type="button"
										onClick={() => setShowAddItem(true)}
										className="ml-1 underline hover:no-underline"
									>
										Add one.
									</button>
								) : null}
							</div>
						) : items.length > 0 ? (
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Product
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Qty
										</th>
										<th
											scope="col"
											className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
										>
											Unit Price
										</th>
										<th
											scope="col"
											className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
										>
											Offered
										</th>
										{isDraft ? (
											<th
												scope="col"
												className="px-4 py-2 font-medium text-muted-foreground text-xs"
											/>
										) : null}
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{items.map((item) =>
										editingItemId === item.id ? (
											<EditItemRow
												key={item.id}
												quoteId={id}
												item={item}
												currency={quote.currency}
												onSaved={() => setEditingItemId(null)}
												onCancel={() => setEditingItemId(null)}
											/>
										) : (
											<tr key={item.id}>
												<td className="px-4 py-2.5">
													<p className="font-medium text-foreground text-sm">
														{item.productName ?? "Product"}
													</p>
													{item.sku ? (
														<p className="text-muted-foreground text-xs">
															SKU: {item.sku}
														</p>
													) : null}
												</td>
												<td className="px-4 py-2.5 text-muted-foreground text-sm">
													{item.quantity}
												</td>
												<td className="px-4 py-2.5 text-right text-muted-foreground text-sm tabular-nums">
													{formatCurrency(item.unitPrice, quote.currency)}
												</td>
												<td className="px-4 py-2.5 text-right font-medium text-foreground text-sm tabular-nums">
													{formatCurrency(
														item.offeredPrice ?? item.unitPrice,
														quote.currency,
													)}
												</td>
												{isDraft ? (
													<td className="px-4 py-2.5">
														<div className="flex gap-2">
															<button
																type="button"
																onClick={() => {
																	setEditingItemId(item.id);
																	setShowAddItem(false);
																}}
																className="text-muted-foreground text-xs hover:text-foreground"
															>
																Edit
															</button>
															<button
																type="button"
																onClick={() => {
																	if (
																		window.confirm(
																			"Remove this item from the quote?",
																		)
																	) {
																		removeItemMutation.mutate({
																			params: { id, itemId: item.id },
																		});
																	}
																}}
																disabled={removeItemMutation.isPending}
																className="text-red-500 text-xs hover:text-red-700 disabled:opacity-50"
															>
																Remove
															</button>
														</div>
													</td>
												) : null}
											</tr>
										),
									)}
								</tbody>
								<tfoot className="border-border border-t">
									{quote.discount ? (
										<tr>
											<td
												colSpan={isDraft ? 4 : 3}
												className="px-4 py-2 text-right text-muted-foreground text-sm"
											>
												Discount
											</td>
											<td className="px-4 py-2 text-right text-green-600 text-sm tabular-nums">
												-{formatCurrency(quote.discount, quote.currency)}
											</td>
										</tr>
									) : null}
									<tr>
										<td
											colSpan={isDraft ? 4 : 3}
											className="px-4 py-2 text-right font-semibold text-foreground text-sm"
										>
											Total
										</td>
										<td className="px-4 py-2 text-right font-semibold text-foreground text-sm tabular-nums">
											{formatCurrency(quote.total, quote.currency)}
										</td>
									</tr>
								</tfoot>
							</table>
						) : null}
					</div>

					{/* Comments */}
					<div className="rounded-lg border border-border bg-card">
						<div className="border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Comments
							</h2>
						</div>
						<div className="divide-y divide-border">
							{comments.length === 0 ? (
								<div className="p-4 text-center text-muted-foreground text-sm">
									No comments yet.
								</div>
							) : (
								comments.map((c) => (
									<div key={c.id} className="px-4 py-3">
										<div className="flex items-center gap-2">
											<span
												className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium text-xs ${
													c.authorType === "admin"
														? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
														: "bg-muted text-muted-foreground"
												}`}
											>
												{c.authorType}
											</span>
											<span className="font-medium text-foreground text-sm">
												{c.authorName ?? "Unknown"}
											</span>
											<span className="text-muted-foreground text-xs">
												{formatDate(c.createdAt)}
											</span>
										</div>
										<p className="mt-1 text-foreground text-sm">{c.message}</p>
									</div>
								))
							)}
						</div>
						<div className="border-border border-t p-4">
							<div className="flex gap-2">
								<input
									type="text"
									value={comment}
									onChange={(e) => setComment(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && comment.trim()) {
											addCommentMutation.mutate({
												params: { id },
												body: { authorName: "Admin", message: comment.trim() },
											});
										}
									}}
									placeholder="Add a comment…"
									className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<button
									type="button"
									onClick={() =>
										addCommentMutation.mutate({
											params: { id },
											body: {
												authorName: "Admin",
												message: comment.trim(),
											},
										})
									}
									disabled={!comment.trim() || addCommentMutation.isPending}
									className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
								>
									{addCommentMutation.isPending ? "Sending…" : "Send"}
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Right column - sidebar */}
				<div className="space-y-6">
					{/* Customer info */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Customer
						</h3>
						<dl className="space-y-2 text-sm">
							{quote.customerName ? (
								<div>
									<dt className="text-muted-foreground">Name</dt>
									<dd className="font-medium text-foreground">
										{quote.customerName}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Email</dt>
								<dd className="font-medium text-foreground">
									{quote.customerEmail}
								</dd>
							</div>
							{quote.companyName ? (
								<div>
									<dt className="text-muted-foreground">Company</dt>
									<dd className="font-medium text-foreground">
										{quote.companyName}
									</dd>
								</div>
							) : null}
						</dl>
					</div>

					{/* Notes */}
					{quote.notes || quote.adminNotes ? (
						<div className="rounded-lg border border-border bg-card p-4">
							<h3 className="mb-3 font-semibold text-foreground text-sm">
								Notes
							</h3>
							{quote.notes ? (
								<div className="mb-2">
									<p className="mb-1 text-muted-foreground text-xs">
										Customer note
									</p>
									<p className="text-foreground text-sm">{quote.notes}</p>
								</div>
							) : null}
							{quote.adminNotes ? (
								<div>
									<p className="mb-1 text-muted-foreground text-xs">
										Admin note
									</p>
									<p className="text-foreground text-sm">{quote.adminNotes}</p>
								</div>
							) : null}
						</div>
					) : null}

					{/* History timeline */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							History
						</h3>
						{history.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No status changes recorded.
							</p>
						) : (
							<div className="space-y-3">
								{history.map((h) => (
									<div key={h.id} className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="h-2 w-2 rounded-full bg-muted-foreground" />
											<div className="w-px flex-1 bg-border" />
										</div>
										<div className="pb-3">
											<p className="text-foreground text-sm">
												{h.fromStatus ? (
													<>
														<span className="capitalize">
															{h.fromStatus.replace(/_/g, " ")}
														</span>
														{" → "}
													</>
												) : null}
												<span className="font-medium capitalize">
													{h.toStatus.replace(/_/g, " ")}
												</span>
											</p>
											{h.reason ? (
												<p className="text-muted-foreground text-xs">
													{h.reason}
												</p>
											) : null}
											<p className="text-muted-foreground text-xs">
												{formatDate(h.createdAt)}
												{h.changedBy ? ` · ${h.changedBy}` : ""}
											</p>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
