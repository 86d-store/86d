"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CartListTemplate from "./cart-list.mdx";

interface Cart {
	id: string;
	customerId?: string | null;
	guestId?: string | null;
	status: "active" | "abandoned" | "converted";
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

interface ListResult {
	carts: Cart[];
	page: number;
	limit: number;
	total: number;
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
const ROW_SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

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

function useCartAdminApi() {
	const client = useModuleClient();
	return {
		listCarts: client.module("cart").admin["/admin/carts"],
		getCartDetails: client.module("cart").admin["/admin/carts/:id"],
		deleteCart: client.module("cart").admin["/admin/carts/:id/delete"],
	};
}

function CartDetailInline({
	cartId,
	onClose,
}: {
	cartId: string;
	onClose: () => void;
}) {
	const api = useCartAdminApi();

	const { data, isLoading: loading } = api.getCartDetails.useQuery({
		params: { id: cartId },
	}) as { data: CartDetailResult | undefined; isLoading: boolean };

	if (loading) {
		return (
			<div className="space-y-2 rounded-md border border-border bg-card p-4">
				{DETAIL_SKELETON_IDS.map((id) => (
					<div
						key={`cart-item-skeleton-${id}`}
						className="h-6 animate-pulse rounded bg-muted"
					/>
				))}
			</div>
		);
	}

	if (!data) {
		return (
			<div className="rounded-md border border-border bg-card p-4 text-muted-foreground text-sm">
				Failed to load cart details.
			</div>
		);
	}

	return (
		<div className="space-y-3 rounded-md border border-border bg-card p-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-foreground text-sm">Cart Details</h3>
				<button
					type="button"
					onClick={onClose}
					className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Close details"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			{data.items.length === 0 ? (
				<p className="text-muted-foreground text-sm">No items in this cart.</p>
			) : (
				<>
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-border border-b bg-muted">
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Product ID
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Variant ID
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Qty
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Price
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Line Total
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.items.map((item) => (
									<tr key={item.id}>
										<td className="px-3 py-1.5 font-mono text-foreground text-xs">
											{item.productId.slice(0, 8)}...
										</td>
										<td className="px-3 py-1.5 font-mono text-muted-foreground text-xs">
											{item.variantId
												? `${item.variantId.slice(0, 8)}...`
												: "—"}
										</td>
										<td className="px-3 py-1.5 text-foreground text-xs">
											{item.quantity}
										</td>
										<td className="px-3 py-1.5 text-foreground text-xs">
											{formatPrice(item.price)}
										</td>
										<td className="px-3 py-1.5 font-medium text-foreground text-xs">
											{formatPrice(item.price * item.quantity)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="flex items-center justify-between border-border border-t pt-2">
						<span className="text-muted-foreground text-sm">
							Subtotal ({data.itemCount}{" "}
							{data.itemCount === 1 ? "item" : "items"})
						</span>
						<span className="font-semibold text-foreground text-sm">
							{formatPrice(data.subtotal)}
						</span>
					</div>
				</>
			)}
		</div>
	);
}

export function CartList() {
	const api = useCartAdminApi();
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<string>("");
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const limit = 20;

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(limit),
	};
	if (status) queryInput.status = status;

	const {
		data: listData,
		isLoading: loading,
		isError: cartsError,
		refetch: refetchCarts,
	} = api.listCarts.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const carts = listData?.carts ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteCart.useMutation({
		onSettled: () => {
			void api.listCarts.invalidate();
		},
	});

	const handleDelete = (cartId: string) => {
		setDeletingId(cartId);
		deleteMutation.mutate(
			{ params: { id: cartId } },
			{
				onSettled: () => {
					setDeletingId(null);
					setConfirmDeleteId(null);
				},
			},
		);
	};

	if (cartsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load carts</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCarts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const totalPages = Math.ceil(total / limit);

	const handleStatusChange = (v: string) => {
		setStatus(v);
		setPage(1);
	};

	const totalCount =
		total > 0 ? (
			<p className="text-muted-foreground text-sm">
				{total} {total === 1 ? "cart" : "carts"}
			</p>
		) : null;

	const mainContent = loading ? (
		<div className="space-y-2">
			{ROW_SKELETON_IDS.map((id) => (
				<div
					key={`cart-row-skeleton-${id}`}
					className="h-12 animate-pulse rounded-md bg-muted"
				/>
			))}
		</div>
	) : carts.length === 0 ? (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<p className="font-medium text-base text-foreground">No carts found</p>
			<p className="text-muted-foreground text-sm">
				Try adjusting your filters
			</p>
			{status && (
				<button
					type="button"
					onClick={() => handleStatusChange("")}
					className="mt-3 text-foreground text-sm underline underline-offset-2"
				>
					Clear filters
				</button>
			)}
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
							Cart ID
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Customer / Guest
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Status
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Created
						</th>
						<th
							scope="col"
							className="px-4 py-2 font-medium text-muted-foreground"
						>
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{carts.map((cart) => (
						<tr key={cart.id} className="transition-colors hover:bg-muted/50">
							<td className="px-4 py-2">
								<button
									type="button"
									onClick={() =>
										setExpandedId(expandedId === cart.id ? null : cart.id)
									}
									className="font-mono text-foreground text-xs underline underline-offset-2 hover:text-foreground/80"
									title={cart.id}
								>
									{cart.id.slice(0, 8)}...
								</button>
							</td>
							<td className="px-4 py-2 text-foreground">
								{cart.customerId ? (
									<span title={cart.customerId}>Registered customer</span>
								) : cart.guestId ? (
									<span className="text-muted-foreground" title={cart.guestId}>
										Guest: {cart.guestId.slice(0, 8)}
										...
									</span>
								) : (
									<span className="text-muted-foreground">—</span>
								)}
							</td>
							<td className="px-4 py-2">
								<span
									className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${statusBadgeClass(cart.status)}`}
								>
									{cart.status}
								</span>
							</td>
							<td className="px-4 py-2 text-muted-foreground text-xs">
								{new Date(cart.createdAt).toLocaleDateString()}
							</td>
							<td className="px-4 py-2">
								<span className="inline-flex items-center gap-2">
									<a
										href={`/admin/carts/${cart.id}`}
										className="text-foreground text-xs underline underline-offset-2 hover:text-foreground/80"
									>
										View
									</a>
									{confirmDeleteId === cart.id ? (
										<span className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => handleDelete(cart.id)}
												disabled={deletingId === cart.id}
												className="font-medium text-destructive text-xs hover:underline disabled:opacity-50"
											>
												{deletingId === cart.id ? "Deleting..." : "Confirm"}
											</button>
											<button
												type="button"
												onClick={() => setConfirmDeleteId(null)}
												className="text-muted-foreground text-xs hover:underline"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setConfirmDeleteId(cart.id)}
											className="text-muted-foreground text-xs underline underline-offset-2 hover:text-destructive disabled:opacity-50"
										>
											Delete
										</button>
									)}
								</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);

	const expandedDetail = expandedId ? (
		<CartDetailInline cartId={expandedId} onClose={() => setExpandedId(null)} />
	) : null;

	const pagination =
		totalPages > 1 ? (
			<div className="flex items-center justify-center gap-2">
				<button
					type="button"
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page === 1}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
				>
					Previous
				</button>
				<span className="text-muted-foreground text-sm">
					Page {page} of {totalPages}
				</span>
				<button
					type="button"
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page === totalPages}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
				>
					Next
				</button>
			</div>
		) : null;

	return (
		<CartListTemplate
			status={status}
			onStatusChange={handleStatusChange}
			totalCount={totalCount}
			mainContent={mainContent}
			expandedDetail={expandedDetail}
			pagination={pagination}
		/>
	);
}
