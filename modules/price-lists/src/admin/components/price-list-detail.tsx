"use client";

import { useState } from "react";
import {
	extractError,
	formatDate,
	type PriceList,
	STATUS_COLORS,
	usePriceListsApi,
} from "./_shared";

interface PriceEntry {
	id: string;
	priceListId: string;
	productId: string;
	price: number;
	compareAtPrice?: number;
	minQuantity?: number;
	maxQuantity?: number;
	createdAt: string;
}

function formatCurrency(amount: number, currency?: string) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency ?? "USD",
		minimumFractionDigits: 2,
	}).format(amount);
}

export function PriceListDetail({
	params,
}: {
	params?: Record<string, string>;
}) {
	const id = params?.id ?? "";
	const api = usePriceListsApi();

	const { data, isLoading } = api.detail.useQuery({ id }) as {
		data:
			| {
					priceList?: PriceList;
					entries?: PriceEntry[];
					entryCount?: number;
			  }
			| undefined;
		isLoading: boolean;
	};

	const updateMutation = api.update.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deletePl.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const setEntryMutation = api.setEntry.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const removeEntryMutation = api.removeEntry.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string; productId: string };
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const priceList = data?.priceList;
	const entries = data?.entries ?? [];
	const entryCount = data?.entryCount ?? 0;

	// Add entry form state
	const [newProductId, setNewProductId] = useState("");
	const [newPrice, setNewPrice] = useState("");
	const [newCompareAt, setNewCompareAt] = useState("");
	const [newMinQty, setNewMinQty] = useState("");
	const [newMaxQty, setNewMaxQty] = useState("");
	const [error, setError] = useState("");

	const handleDelete = async () => {
		if (!confirm("Delete this price list and all its entries?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.href = "/admin/price-lists";
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleStatusChange = async (newStatus: string) => {
		try {
			await updateMutation.mutateAsync({
				params: { id },
				body: { status: newStatus },
			});
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleAddEntry = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!newProductId.trim() || !newPrice.trim()) {
			setError("Product ID and price are required.");
			return;
		}
		try {
			await setEntryMutation.mutateAsync({
				params: { id },
				body: {
					productId: newProductId.trim(),
					price: Number.parseFloat(newPrice),
					...(newCompareAt
						? { compareAtPrice: Number.parseFloat(newCompareAt) }
						: {}),
					...(newMinQty ? { minQuantity: Number.parseInt(newMinQty, 10) } : {}),
					...(newMaxQty ? { maxQuantity: Number.parseInt(newMaxQty, 10) } : {}),
				},
			});
			setNewProductId("");
			setNewPrice("");
			setNewCompareAt("");
			setNewMinQty("");
			setNewMaxQty("");
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleRemoveEntry = async (productId: string) => {
		if (!confirm("Remove this price entry?")) return;
		try {
			await removeEntryMutation.mutateAsync({
				params: { id, productId },
			});
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/price-lists"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to price lists
					</a>
				</div>
				<div className="space-y-4">
					<div className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
					<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
				</div>
			</div>
		);
	}

	if (!priceList) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/price-lists"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to price lists
					</a>
				</div>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Price list not found.</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/price-lists"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to price lists
				</a>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main content */}
				<div className="space-y-6 lg:col-span-2">
					{/* Header */}
					<div className="rounded-lg border border-border bg-card p-5">
						<div className="mb-3 flex items-start justify-between gap-3">
							<div>
								<h1 className="font-bold text-foreground text-lg">
									{priceList.name}
								</h1>
								{priceList.description ? (
									<p className="mt-1 text-muted-foreground text-sm">
										{priceList.description}
									</p>
								) : null}
							</div>
							<span
								className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[priceList.status] ?? "bg-muted text-muted-foreground"}`}
							>
								{priceList.status}
							</span>
						</div>
						<div className="flex flex-wrap gap-2 border-border border-t pt-3">
							{priceList.status !== "active" ? (
								<button
									type="button"
									onClick={() => handleStatusChange("active")}
									className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-green-700"
								>
									Activate
								</button>
							) : (
								<button
									type="button"
									onClick={() => handleStatusChange("inactive")}
									className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
								>
									Deactivate
								</button>
							)}
							<button
								type="button"
								onClick={handleDelete}
								disabled={deleteMutation.isPending}
								className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
							>
								Delete
							</button>
						</div>
					</div>

					{/* Entries */}
					<div className="rounded-lg border border-border bg-card">
						<div className="border-border border-b px-4 py-3">
							<h2 className="font-semibold text-foreground text-sm">
								Price Entries ({entryCount})
							</h2>
						</div>

						{entries.length === 0 ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								No entries yet. Add product prices below.
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-border border-b bg-muted/40">
											<th
												scope="col"
												className="px-4 py-2 text-left font-medium text-muted-foreground text-xs"
											>
												Product ID
											</th>
											<th
												scope="col"
												className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
											>
												Price
											</th>
											<th
												scope="col"
												className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
											>
												Compare At
											</th>
											<th
												scope="col"
												className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
											>
												Qty Range
											</th>
											<th
												scope="col"
												className="px-4 py-2 text-right font-medium text-muted-foreground text-xs"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{entries.map((entry) => (
											<tr key={entry.id} className="hover:bg-muted/30">
												<td className="px-4 py-2 font-mono text-sm">
													{entry.productId}
												</td>
												<td className="px-4 py-2 text-right text-sm">
													{formatCurrency(entry.price, priceList.currency)}
												</td>
												<td className="px-4 py-2 text-right text-muted-foreground text-sm">
													{entry.compareAtPrice
														? formatCurrency(
																entry.compareAtPrice,
																priceList.currency,
															)
														: "—"}
												</td>
												<td className="px-4 py-2 text-right text-muted-foreground text-sm">
													{entry.minQuantity || entry.maxQuantity
														? `${entry.minQuantity ?? 1}–${entry.maxQuantity ?? "∞"}`
														: "Any"}
												</td>
												<td className="px-4 py-2 text-right">
													<button
														type="button"
														onClick={() => handleRemoveEntry(entry.productId)}
														className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
													>
														Remove
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{/* Add entry form */}
						<div className="border-border border-t p-4">
							<h3 className="mb-3 font-medium text-foreground text-sm">
								Add Price Entry
							</h3>
							<form
								onSubmit={handleAddEntry}
								className="flex flex-wrap items-end gap-2"
							>
								<label className="block">
									<span className="mb-1 block text-muted-foreground text-xs">
										Product ID
									</span>
									<input
										type="text"
										value={newProductId}
										onChange={(e) => setNewProductId(e.target.value)}
										placeholder="prod_..."
										className="w-40 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block text-muted-foreground text-xs">
										Price
									</span>
									<input
										type="number"
										step="0.01"
										min="0"
										value={newPrice}
										onChange={(e) => setNewPrice(e.target.value)}
										placeholder="0.00"
										className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block text-muted-foreground text-xs">
										Compare At
									</span>
									<input
										type="number"
										step="0.01"
										min="0"
										value={newCompareAt}
										onChange={(e) => setNewCompareAt(e.target.value)}
										placeholder="—"
										className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block text-muted-foreground text-xs">
										Min Qty
									</span>
									<input
										type="number"
										min="1"
										value={newMinQty}
										onChange={(e) => setNewMinQty(e.target.value)}
										placeholder="—"
										className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block text-muted-foreground text-xs">
										Max Qty
									</span>
									<input
										type="number"
										min="1"
										value={newMaxQty}
										onChange={(e) => setNewMaxQty(e.target.value)}
										placeholder="—"
										className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
									/>
								</label>
								<button
									type="submit"
									disabled={setEntryMutation.isPending}
									className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
								>
									{setEntryMutation.isPending ? "Adding..." : "Add"}
								</button>
							</form>
						</div>
					</div>
				</div>

				{/* Right sidebar */}
				<div>
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h3>
						<dl className="space-y-2 text-sm">
							<div>
								<dt className="text-muted-foreground">Status</dt>
								<dd className="font-medium text-foreground capitalize">
									{priceList.status}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Slug</dt>
								<dd className="font-medium font-mono text-foreground">
									{priceList.slug}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Priority</dt>
								<dd className="font-medium text-foreground">
									{priceList.priority}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Currency</dt>
								<dd className="font-medium text-foreground">
									{priceList.currency ?? "Default"}
								</dd>
							</div>
							{priceList.customerGroupId ? (
								<div>
									<dt className="text-muted-foreground">Customer Group</dt>
									<dd className="font-medium font-mono text-foreground">
										{priceList.customerGroupId}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Starts</dt>
								<dd className="font-medium text-foreground">
									{formatDate(priceList.startsAt)}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Ends</dt>
								<dd className="font-medium text-foreground">
									{formatDate(priceList.endsAt)}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Entries</dt>
								<dd className="font-medium text-foreground">{entryCount}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium text-foreground">
									{formatDate(priceList.createdAt)}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Updated</dt>
								<dd className="font-medium text-foreground">
									{formatDate(priceList.updatedAt)}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	);
}
