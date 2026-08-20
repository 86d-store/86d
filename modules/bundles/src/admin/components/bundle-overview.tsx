"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import BundleOverviewTemplate from "./bundle-overview.mdx";

interface Bundle {
	id: string;
	name: string;
	slug: string;
	description?: string;
	status: "active" | "draft" | "archived";
	discountType: "fixed" | "percentage";
	discountValue: number;
	minQuantity?: number;
	maxQuantity?: number;
	startsAt?: string;
	endsAt?: string;
	imageUrl?: string;
	sortOrder?: number;
	createdAt: string;
	updatedAt: string;
}

interface BundleItem {
	id: string;
	bundleId: string;
	productId: string;
	variantId?: string;
	quantity: number;
	sortOrder?: number;
	productName?: string | undefined;
	productSlug?: string | undefined;
	productImageUrl?: string | undefined;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function formatDiscount(type: string, value: number): string {
	if (type === "percentage") return `${value}% off`;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);
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

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	archived: "bg-muted text-muted-foreground",
};

function useBundleAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("bundles").admin["/admin/bundles"],
		create: client.module("bundles").admin["/admin/bundles/create"],
		get: client.module("bundles").admin["/admin/bundles/:id"],
		update: client.module("bundles").admin["/admin/bundles/:id/update"],
		deleteBundle: client.module("bundles").admin["/admin/bundles/:id/delete"],
		listItems: client.module("bundles").admin["/admin/bundles/:id/items"],
		addItem: client.module("bundles").admin["/admin/bundles/:id/items/add"],
		removeItem:
			client.module("bundles").admin["/admin/bundles/:id/items/:itemId/remove"],
		updateItem:
			client.module("bundles").admin["/admin/bundles/:id/items/:itemId/update"],
	};
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function CreateForm({ onClose }: { onClose: () => void }) {
	const api = useBundleAdminApi();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugManual, setSlugManual] = useState(false);
	const [description, setDescription] = useState("");
	const [discountType, setDiscountType] = useState<"fixed" | "percentage">(
		"percentage",
	);
	const [discountValue, setDiscountValue] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSettled: () => {
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create bundle."));
		},
		onSuccess: () => {
			onClose();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const val = Number.parseFloat(discountValue);
		if (Number.isNaN(val) || val < 0) {
			setError("Enter a valid discount value.");
			return;
		}
		const finalSlug = slug || slugify(name);
		if (!finalSlug) {
			setError("Name must produce a valid slug.");
			return;
		}
		createMutation.mutate({
			name,
			slug: finalSlug,
			discountType,
			discountValue: val,
			...(description ? { description } : {}),
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Bundle Name *
					</span>
					<input
						type="text"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							if (!slugManual) setSlug(slugify(e.target.value));
						}}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="Summer Essentials"
						required
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Slug
					</span>
					<input
						type="text"
						value={slug}
						onChange={(e) => {
							setSlug(e.target.value);
							setSlugManual(true);
						}}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="summer-essentials"
					/>
				</label>
			</div>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					Description
				</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={2}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="Get everything you need for summer..."
				/>
			</label>
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Discount Type *
					</span>
					<select
						value={discountType}
						onChange={(e) =>
							setDiscountType(e.target.value as "fixed" | "percentage")
						}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="percentage">Percentage Off</option>
						<option value="fixed">Fixed Price</option>
					</select>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						{discountType === "percentage"
							? "Discount (%)"
							: "Bundle Price ($)"}{" "}
						*
					</span>
					<input
						type="number"
						step="0.01"
						min="0"
						value={discountValue}
						onChange={(e) => setDiscountValue(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder={discountType === "percentage" ? "15" : "49.99"}
						required
					/>
				</label>
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Bundle"}
				</button>
			</div>
		</form>
	);
}

function DetailPanel({
	bundleId,
	onClose,
}: {
	bundleId: string;
	onClose: () => void;
}) {
	const api = useBundleAdminApi();
	const [productId, setProductId] = useState("");
	const [productName, setProductName] = useState("");
	const [productSlug, setProductSlug] = useState("");
	const [itemQty, setItemQty] = useState("1");
	const [error, setError] = useState("");

	const { data: bundleData, isLoading } = api.get.useQuery({
		params: { id: bundleId },
	}) as {
		data: { bundle: Bundle & { items: BundleItem[] } } | undefined;
		isLoading: boolean;
	};

	const bundle = bundleData?.bundle;
	const items = bundle?.items ?? [];

	const addMutation = api.addItem.useMutation({
		onSettled: () => {
			setProductId("");
			setProductName("");
			setProductSlug("");
			setItemQty("1");
			void api.get.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to add item."));
		},
	});

	const removeMutation = api.removeItem.useMutation({
		onSettled: () => {
			void api.get.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to remove item."));
		},
	});

	const statusMutation = api.update.useMutation({
		onSettled: () => {
			void api.get.invalidate();
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update status."));
		},
	});

	const handleAddItem = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!productId.trim()) return;
		addMutation.mutate({
			params: { id: bundleId },
			productId: productId.trim(),
			quantity: Number.parseInt(itemQty, 10) || 1,
			...(productName.trim() ? { productName: productName.trim() } : {}),
			...(productSlug.trim() ? { productSlug: productSlug.trim() } : {}),
		});
	};

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-5">
				<div className="flex items-center justify-between">
					<div className="h-4 w-24 rounded bg-muted" />
					<div className="h-5 w-16 rounded-full bg-muted" />
				</div>
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-start justify-between">
						<div>
							<div className="h-5 w-40 rounded bg-muted" />
							<div className="mt-1.5 h-3 w-24 rounded bg-muted" />
						</div>
						<div className="h-7 w-20 rounded-md bg-muted" />
					</div>
					<div className="mt-4 grid grid-cols-2 gap-4">
						{Array.from({ length: 2 }).map((_, i) => (
							<div key={i}>
								<div className="h-3 w-16 rounded bg-muted" />
								<div className="mt-1.5 h-4 w-24 rounded bg-muted" />
							</div>
						))}
					</div>
					<div className="mt-4 flex gap-2">
						<div className="h-8 w-20 rounded-md bg-muted" />
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card">
					<div className="border-border border-b px-5 py-3">
						<div className="h-4 w-32 rounded bg-muted" />
					</div>
					<div className="divide-y divide-border">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between px-5 py-3"
							>
								<div className="h-4 w-28 rounded bg-muted" />
								<div className="h-3 w-16 rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!bundle) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Bundle not found.
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to list
				</button>
				<span
					className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[bundle.status] ?? ""}`}
				>
					{bundle.status}
				</span>
			</div>

			<div className="rounded-lg border border-border bg-card p-5">
				<div className="flex items-start justify-between">
					<div>
						<p className="font-semibold text-foreground text-lg">
							{bundle.name}
						</p>
						<p className="mt-0.5 font-mono text-muted-foreground text-xs">
							/{bundle.slug}
						</p>
					</div>
					<span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground text-sm">
						{formatDiscount(bundle.discountType, bundle.discountValue)}
					</span>
				</div>

				{bundle.description && (
					<p className="mt-3 text-muted-foreground text-sm">
						{bundle.description}
					</p>
				)}

				<div className="mt-4 grid grid-cols-2 gap-4">
					<div>
						<p className="text-muted-foreground text-xs">Created</p>
						<p className="mt-0.5 text-foreground text-sm">
							{formatDate(bundle.createdAt)}
						</p>
					</div>
					{bundle.startsAt && (
						<div>
							<p className="text-muted-foreground text-xs">Starts</p>
							<p className="mt-0.5 text-foreground text-sm">
								{formatDate(bundle.startsAt)}
							</p>
						</div>
					)}
					{bundle.endsAt && (
						<div>
							<p className="text-muted-foreground text-xs">Ends</p>
							<p className="mt-0.5 text-foreground text-sm">
								{formatDate(bundle.endsAt)}
							</p>
						</div>
					)}
				</div>

				<div className="mt-4 flex gap-2">
					{bundle.status === "draft" && (
						<button
							type="button"
							onClick={() =>
								statusMutation.mutate({
									params: { id: bundleId },
									status: "active",
								})
							}
							className="rounded-md bg-green-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-green-700"
						>
							Activate
						</button>
					)}
					{bundle.status === "active" && (
						<button
							type="button"
							onClick={() =>
								statusMutation.mutate({
									params: { id: bundleId },
									status: "archived",
								})
							}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Archive
						</button>
					)}
					{bundle.status === "archived" && (
						<button
							type="button"
							onClick={() =>
								statusMutation.mutate({
									params: { id: bundleId },
									status: "draft",
								})
							}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Move to Draft
						</button>
					)}
				</div>
			</div>

			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}

			<div className="rounded-lg border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Bundle Items ({items.length})
					</h3>
				</div>

				{items.length === 0 ? (
					<div className="px-5 py-6 text-center text-muted-foreground text-sm">
						No items yet. Add products to this bundle.
					</div>
				) : (
					<div className="divide-y divide-border">
						{items.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between px-5 py-3"
							>
								<div>
									<p className="font-medium text-foreground text-sm">
										{item.productName ?? item.productId}
									</p>
									<p className="font-mono text-muted-foreground text-xs">
										{item.productId.slice(0, 12)}…
									</p>
									{item.variantId && (
										<p className="text-muted-foreground text-xs">
											Variant: {item.variantId}
										</p>
									)}
								</div>
								<div className="flex items-center gap-3">
									<span className="text-muted-foreground text-sm">
										Qty: {item.quantity}
									</span>
									<button
										type="button"
										onClick={() =>
											removeMutation.mutate({
												params: { id: bundleId, itemId: item.id },
											})
										}
										className="text-muted-foreground text-xs hover:text-destructive"
									>
										Remove
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				<div className="border-border border-t px-5 py-3">
					<form onSubmit={handleAddItem} className="flex flex-col gap-2">
						<div className="flex items-end gap-3">
							<label className="flex-1">
								<span className="mb-1 block text-muted-foreground text-xs">
									Product ID *
								</span>
								<input
									type="text"
									value={productId}
									onChange={(e) => setProductId(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									placeholder="UUID from products table"
									required
								/>
							</label>
							<label className="w-20">
								<span className="mb-1 block text-muted-foreground text-xs">
									Qty
								</span>
								<input
									type="number"
									min="1"
									value={itemQty}
									onChange={(e) => setItemQty(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</label>
						</div>
						<div className="flex items-end gap-3">
							<label className="flex-1">
								<span className="mb-1 block text-muted-foreground text-xs">
									Product name (for store display)
								</span>
								<input
									type="text"
									value={productName}
									onChange={(e) => setProductName(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									placeholder="e.g. Organic Cotton T-Shirt"
								/>
							</label>
							<label className="flex-1">
								<span className="mb-1 block text-muted-foreground text-xs">
									Product slug (for store links)
								</span>
								<input
									type="text"
									value={productSlug}
									onChange={(e) => setProductSlug(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									placeholder="e.g. organic-cotton-t-shirt"
								/>
							</label>
							<button
								type="submit"
								disabled={addMutation.isPending}
								className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
							>
								{addMutation.isPending ? "Adding..." : "Add Item"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

export function BundleOverview() {
	const api = useBundleAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const {
		data: listData,
		isLoading,
		isError: bundlesError,
		refetch: refetchBundles,
	} = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { bundles: Bundle[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const bundles = listData?.bundles ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteBundle.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.list.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete bundle."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	if (bundlesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load bundles</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchBundles()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	if (selectedId) {
		return (
			<DetailPanel bundleId={selectedId} onClose={() => setSelectedId(null)} />
		);
	}

	const tableContent =
		bundles.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No bundles found.
			</div>
		) : (
			<>
				<div className="hidden md:block">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Discount
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Created
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{bundles.map((bundle) => (
								<tr
									key={bundle.id}
									className="cursor-pointer hover:bg-muted/30"
									onClick={() => setSelectedId(bundle.id)}
								>
									<td className="px-5 py-3">
										<p className="font-medium text-foreground">{bundle.name}</p>
										<p className="mt-0.5 font-mono text-muted-foreground text-xs">
											/{bundle.slug}
										</p>
									</td>
									<td className="px-5 py-3 text-foreground">
										{formatDiscount(bundle.discountType, bundle.discountValue)}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[bundle.status] ?? ""}`}
										>
											{bundle.status}
										</span>
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(bundle.createdAt)}
									</td>
									<td
										className="px-5 py-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										{deleteConfirm === bundle.id ? (
											<span className="space-x-2">
												<button
													type="button"
													onClick={() => handleDelete(bundle.id)}
													className="font-medium text-destructive text-xs hover:opacity-80"
												>
													Confirm
												</button>
												<button
													type="button"
													onClick={() => setDeleteConfirm(null)}
													className="text-muted-foreground text-xs hover:text-foreground"
												>
													Cancel
												</button>
											</span>
										) : (
											<button
												type="button"
												onClick={() => setDeleteConfirm(bundle.id)}
												className="text-muted-foreground text-xs hover:text-destructive"
											>
												Delete
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{bundles.map((bundle) => (
						<button
							key={bundle.id}
							type="button"
							onClick={() => setSelectedId(bundle.id)}
							className="w-full px-5 py-3 text-left"
						>
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium text-foreground text-sm">
										{bundle.name}
									</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{formatDiscount(bundle.discountType, bundle.discountValue)}
									</p>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[bundle.status] ?? ""}`}
								>
									{bundle.status}
								</span>
							</div>
						</button>
					))}
				</div>

				{total > PAGE_SIZE && (
					<div className="flex items-center justify-between border-border border-t px-5 py-3">
						<span className="text-muted-foreground text-sm">
							Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
						</span>
						<span className="space-x-2">
							<button
								type="button"
								onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
								disabled={skip === 0}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() => setSkip((s) => s + PAGE_SIZE)}
								disabled={skip + PAGE_SIZE >= total}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Next
							</button>
						</span>
					</div>
				)}
			</>
		);

	return (
		<BundleOverviewTemplate
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setSkip(0);
			}}
			onCreateClick={() => setShowCreate(true)}
			createForm={
				showCreate ? (
					<div className="rounded-lg border border-border bg-card p-5">
						<h3 className="mb-4 font-semibold text-foreground">
							Create New Bundle
						</h3>
						<CreateForm onClose={() => setShowCreate(false)} />
					</div>
				) : null
			}
			error={error}
			loading={isLoading}
			tableContent={tableContent}
		/>
	);
}
