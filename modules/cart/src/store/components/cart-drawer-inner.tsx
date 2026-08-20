"use client";

import { observer } from "@86d-app/core/state";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { cartState } from "../../state";
import { useCartApi, useTrack } from "./_hooks";
import { formatPrice } from "./_utils";
import CartDrawerInnerTemplate from "./cart-drawer-inner.mdx";

interface CartItem {
	id: string;
	productId: string;
	variantId?: string | null;
	quantity: number;
	price: number;
	product: {
		name: string;
		price: number;
		images?: string[] | null;
		slug: string;
	};
	variant?: {
		name: string;
		options?: Record<string, string>;
	} | null;
}

interface CartData {
	id: string;
	items: CartItem[];
	subtotal: number;
	itemCount: number;
}

/** Panel body only: header, scrollable item list, footer. Rendered inside Sheet in cart.mdx. */
export const CartDrawerInner = observer(() => {
	const api = useCartApi();
	const track = useTrack();
	const {
		data: cart,
		isError: cartError,
		refetch: cartRefetch,
	} = api.getCart.useQuery() as {
		data: CartData | undefined;
		isError: boolean;
		refetch: () => void;
	};

	const removeMutation = api.removeFromCart.useMutation({
		onSettled: () => void api.getCart.invalidate(),
	});

	const updateMutation = api.updateCartItem.useMutation({
		onSettled: () => void api.getCart.invalidate(),
	});

	const clearMutation = api.clearCart.useMutation({
		onSettled: () => {
			cartState.setOptimisticCart(null);
			cartState.setItemCount(0);
			void api.getCart.invalidate();
		},
	});

	const loading =
		removeMutation.isPending ||
		updateMutation.isPending ||
		clearMutation.isPending;
	const queryItemCount = cart?.itemCount ?? 0;
	const displayCart =
		queryItemCount > 0 ? cart : (cartState.optimisticCart ?? cart);
	const itemCount = displayCart?.itemCount ?? 0;
	const awaitingCartSync =
		queryItemCount === 0 &&
		(cartState.optimisticCart?.itemCount ?? 0) === 0 &&
		cartState.itemCount > 0 &&
		!cartError;

	useEffect(() => {
		if (queryItemCount > 0) {
			cartState.setOptimisticCart(null);
			cartState.setItemCount(queryItemCount);
		}
	}, [queryItemCount]);

	useEffect(() => {
		if (cartState.isDrawerOpen && awaitingCartSync) {
			void cartRefetch();
		}
	}, [cartState.isDrawerOpen, awaitingCartSync, cartRefetch]);

	const handleRemove = (itemId: string) => {
		const item = displayCart?.items.find((i) => i.id === itemId);
		removeMutation.mutate({ params: { id: itemId } });
		if (item) {
			track({
				type: "removeFromCart",
				productId: item.productId,
				value: item.price,
				data: { name: item.product.name, quantity: item.quantity },
			});
		}
	};

	const handleUpdateQty = (itemId: string, quantity: number) => {
		if (quantity < 1) {
			handleRemove(itemId);
			return;
		}
		updateMutation.mutate({ params: { id: itemId }, quantity });
	};

	const handleClear = () => {
		clearMutation.mutate(undefined);
	};

	const bodyContent = cartError ? (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<p className="font-medium text-destructive text-sm">
				Failed to load cart
			</p>
			<p className="text-muted-foreground text-xs">
				Something went wrong. Please try again.
			</p>
			<button
				type="button"
				onClick={() => cartRefetch()}
				className="mt-3 rounded-md bg-foreground px-4 py-1.5 font-medium text-background text-xs transition-opacity hover:opacity-85"
			>
				Try again
			</button>
		</div>
	) : awaitingCartSync ? (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
			<p className="text-muted-foreground text-sm">Updating cart…</p>
		</div>
	) : !displayCart || itemCount === 0 ? (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<p className="text-foreground text-sm">Your cart is empty</p>
			<p className="text-muted-foreground text-xs">Add items to get started.</p>
			<button
				type="button"
				onClick={() => cartState.closeDrawer()}
				className="mt-3 rounded-md bg-foreground px-4 py-1.5 font-medium text-background text-xs transition-opacity hover:opacity-85"
			>
				Continue shopping
			</button>
		</div>
	) : (
		<ul className="divide-y divide-border/40">
			{displayCart.items.map((item) => {
				const price = item.price;
				const image = item.product.images?.[0];
				return (
					<li key={item.id} className="flex gap-3 py-3.5">
						<Link
							href={`/products/${item.product.slug}`}
							className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted"
						>
							{image ? (
								<Image
									src={image}
									alt={item.product.name}
									width={64}
									height={64}
									unoptimized
									className="h-full w-full object-cover object-center"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<rect width="18" height="18" x="3" y="3" rx="2" />
										<circle cx="9" cy="9" r="2" />
										<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
									</svg>
								</div>
							)}
						</Link>

						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<Link
										href={`/products/${item.product.slug}`}
										className="block truncate text-foreground text-sm"
									>
										{item.product.name}
									</Link>
									{item.variant && (
										<p className="text-muted-foreground text-xs">
											{item.variant.options &&
											Object.keys(item.variant.options).length > 0
												? Object.values(item.variant.options).join(" / ")
												: item.variant.name}
										</p>
									)}
								</div>
								<p className="flex-shrink-0 text-foreground text-sm tabular-nums">
									{formatPrice(price * item.quantity)}
								</p>
							</div>

							<div className="mt-auto flex items-center gap-2.5 pt-0.5">
								<div className="flex items-center rounded-md border border-border">
									<button
										type="button"
										onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
										disabled={loading}
										className="flex h-6 w-6 items-center justify-center text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-40"
										aria-label="Decrease quantity"
									>
										−
									</button>
									<span className="min-w-5 text-center text-foreground text-xs tabular-nums">
										{item.quantity}
									</span>
									<button
										type="button"
										onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
										disabled={loading}
										className="flex h-6 w-6 items-center justify-center text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-40"
										aria-label="Increase quantity"
									>
										+
									</button>
								</div>
								<button
									type="button"
									onClick={() => handleRemove(item.id)}
									disabled={loading}
									className="text-muted-foreground text-xs transition-colors hover:text-destructive disabled:opacity-40"
								>
									Remove
								</button>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);

	const footerContent =
		displayCart && itemCount > 0 ? (
			<div className="space-y-2.5 border-border/50 border-t px-5 py-4">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm">Subtotal</span>
					<span className="font-display text-base text-foreground tabular-nums">
						{formatPrice(displayCart.subtotal)}
					</span>
				</div>
				<p className="text-muted-foreground/60 text-xs">
					Shipping and taxes at checkout.
				</p>
				<a
					href="/checkout"
					className="block w-full rounded-md bg-foreground py-2.5 text-center font-medium text-background text-sm transition-opacity hover:opacity-85"
				>
					Checkout
				</a>
				<a
					href="/cart"
					className="block w-full text-center text-muted-foreground text-xs transition-colors hover:text-foreground"
				>
					View cart
				</a>
			</div>
		) : null;

	return (
		<CartDrawerInnerTemplate
			itemCount={itemCount}
			loading={loading}
			onClear={handleClear}
			bodyContent={bodyContent}
			footerContent={footerContent}
		/>
	);
});
