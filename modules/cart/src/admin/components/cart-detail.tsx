"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CartDetailTemplate from "./cart-detail.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cart {
	id: string;
	customerId?: string | null;
	guestId?: string | null;
	status: "active" | "abandoned" | "converted";
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

interface CartItem {
	id: string;
	cartId: string;
	productId: string;
	variantId?: string | null;
	quantity: number;
	price: number;
	createdAt: string;
}

interface CartDetailResult {
	cart: Cart;
	items: CartItem[];
	itemCount: number;
	subtotal: number;
}

const DETAIL_SKELETON_IDS = ["header", "body", "footer"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function statusBadgeClass(status: Cart["status"]): string {
	switch (status) {
		case "active":
			return "bg-green-100 text-green-800";
		case "abandoned":
			return "bg-yellow-100 text-yellow-800";
		case "converted":
			return "bg-blue-100 text-blue-800";
		default:
			return "bg-muted text-muted-foreground";
	}
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

function useCartAdminApi() {
	const client = useModuleClient();
	return {
		getCartDetails: client.module("cart").admin["/admin/carts/:id"],
		deleteCart: client.module("cart").admin["/admin/carts/:id/delete"],
	};
}

// ─── CartDetail ───────────────────────────────────────────────────────────────

interface CartDetailProps {
	cartId?: string;
	params?: Record<string, string>;
}

export function CartDetail(props: CartDetailProps) {
	const cartId = props.cartId ?? props.params?.id;
	const api = useCartAdminApi();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleted, setDeleted] = useState(false);

	const {
		data,
		isLoading: loading,
		isError,
		error,
	} = api.getCartDetails.useQuery(
		{ params: { id: cartId ?? "" } },
		{ enabled: !!cartId },
	) as {
		data: CartDetailResult | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const deleteMutation = api.deleteCart.useMutation({
		onSuccess: () => {
			setDeleted(true);
			setConfirmDelete(false);
		},
	});

	const handleDelete = () => {
		deleteMutation.mutate({ params: { id: cartId } });
	};

	if (!cartId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Cart not found</p>
				<p className="mt-1 text-sm">No cart ID was provided.</p>
				<a href="/admin/carts" className="mt-3 inline-block text-sm underline">
					Back to carts
				</a>
			</div>
		);
	}

	// ── Loading skeleton ──────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
				<div className="space-y-3 rounded-md border border-border bg-card p-6">
					<div className="h-5 w-64 animate-pulse rounded bg-muted" />
					<div className="h-5 w-40 animate-pulse rounded bg-muted" />
					<div className="h-5 w-56 animate-pulse rounded bg-muted" />
					<div className="h-5 w-48 animate-pulse rounded bg-muted" />
				</div>
				<div className="space-y-2 rounded-md border border-border bg-card p-6">
					{DETAIL_SKELETON_IDS.map((id) => (
						<div
							key={`detail-skeleton-${id}`}
							className="h-8 animate-pulse rounded bg-muted"
						/>
					))}
				</div>
			</div>
		);
	}

	// ── Error state ───────────────────────────────────────────────────────
	if (isError || !data) {
		const errorMsg = extractError(error, "Cart not found");
		return (
			<div className="rounded-md border border-border bg-card p-6 text-center">
				<p className="font-medium text-foreground text-sm">{errorMsg}</p>
				<p className="mt-1 text-muted-foreground text-xs">
					The cart may have been deleted or does not exist.
				</p>
			</div>
		);
	}

	// ── Deleted state ─────────────────────────────────────────────────────
	if (deleted) {
		return (
			<div className="rounded-md border border-border bg-card p-6 text-center">
				<p className="font-medium text-foreground text-sm">
					Cart deleted successfully.
				</p>
			</div>
		);
	}

	const { cart, items, itemCount, subtotal } = data;

	const content = (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-foreground text-lg">Cart Detail</h2>
				{confirmDelete ? (
					<span className="flex items-center gap-2">
						<span className="text-muted-foreground text-sm">
							Delete this cart?
						</span>
						<button
							type="button"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
						</button>
						<button
							type="button"
							onClick={() => setConfirmDelete(false)}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</span>
				) : (
					<button
						type="button"
						onClick={() => setConfirmDelete(true)}
						className="rounded-md border border-border px-3 py-1.5 text-destructive text-sm hover:bg-muted"
					>
						Delete Cart
					</button>
				)}
			</div>

			{/* Cart info card */}
			<div className="rounded-md border border-border bg-card p-6">
				<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground text-xs">Cart ID</dt>
						<dd className="mt-0.5 font-mono text-foreground text-sm">
							{cart.id}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Status</dt>
						<dd className="mt-0.5">
							<span
								className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${statusBadgeClass(cart.status)}`}
							>
								{cart.status}
							</span>
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Customer / Guest</dt>
						<dd className="mt-0.5 text-foreground text-sm">
							{cart.customerId ? (
								<span>
									Customer: <span className="font-mono">{cart.customerId}</span>
								</span>
							) : cart.guestId ? (
								<span className="text-muted-foreground">
									Guest: <span className="font-mono">{cart.guestId}</span>
								</span>
							) : (
								<span className="text-muted-foreground">—</span>
							)}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Created</dt>
						<dd className="mt-0.5 text-foreground text-sm">
							{new Date(cart.createdAt).toLocaleString()}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Expires</dt>
						<dd className="mt-0.5 text-foreground text-sm">
							{new Date(cart.expiresAt).toLocaleString()}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Last Updated</dt>
						<dd className="mt-0.5 text-foreground text-sm">
							{new Date(cart.updatedAt).toLocaleString()}
						</dd>
					</div>
				</dl>
			</div>

			{/* Items table */}
			<div className="space-y-3">
				<h3 className="font-semibold text-foreground text-sm">
					Items ({itemCount})
				</h3>

				{items.length === 0 ? (
					<div className="rounded-md border border-border bg-card p-6 text-center">
						<p className="text-muted-foreground text-sm">
							No items in this cart.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-border border-b bg-muted">
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Product ID
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Variant ID
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Quantity
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Price
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Line Total
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{items.map((item) => (
									<tr
										key={item.id}
										className="transition-colors hover:bg-muted/50"
									>
										<td className="px-4 py-2 font-mono text-foreground text-xs">
											{item.productId}
										</td>
										<td className="px-4 py-2 font-mono text-muted-foreground text-xs">
											{item.variantId ?? "—"}
										</td>
										<td className="px-4 py-2 text-foreground text-sm">
											{item.quantity}
										</td>
										<td className="px-4 py-2 text-foreground text-sm">
											{formatPrice(item.price)}
										</td>
										<td className="px-4 py-2 font-medium text-foreground text-sm">
											{formatPrice(item.price * item.quantity)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Subtotal */}
				{items.length > 0 && (
					<div className="flex items-center justify-between border-border border-t pt-3">
						<span className="text-muted-foreground text-sm">Subtotal</span>
						<span className="font-semibold text-base text-foreground">
							{formatPrice(subtotal)}
						</span>
					</div>
				)}
			</div>
		</div>
	);

	return <CartDetailTemplate content={content} />;
}
