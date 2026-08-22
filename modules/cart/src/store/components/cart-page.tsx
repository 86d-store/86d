"use client";

import { observer } from "mobx-react-lite";
import Image from "next/image";
import { useEffect } from "react";
import { cartState } from "../../state";
import { useCartApi, useTrack } from "./_hooks";
import { formatPrice } from "./_utils";
import CartPageTemplate from "./cart-page.mdx";

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

/** Full-page cart view. Shows items, quantities, and checkout CTA. */
export const CartPage = observer(() => {
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
		onSettled: () => void api.getCart.invalidate(),
	});

	const loading =
		removeMutation.isPending ||
		updateMutation.isPending ||
		clearMutation.isPending;
	const itemCount = cart?.itemCount ?? 0;

	useEffect(() => {
		cartState.setItemCount(itemCount);
	}, [itemCount]);

	const handleRemove = (itemId: string) => {
		const item = cart?.items.find((i) => i.id === itemId);
		removeMutation.mutate({ params: { id: itemId } });
		if (item) {
			track({
				type: "removeFromCart",
				productId: item.productId,
				value: item.price,
			});
		}
	};

	const handleQuantityChange = (itemId: string, quantity: number) => {
		if (quantity < 1) {
			handleRemove(itemId);
			return;
		}
		updateMutation.mutate({ params: { id: itemId }, body: { quantity } });
	};

	if (cartError) {
		return (
			<div className="mx-auto max-w-4xl px-4 py-10">
				<p className="text-destructive text-sm">Failed to load cart.</p>
				<button
					type="button"
					onClick={() => void cartRefetch()}
					className="mt-2 text-muted-foreground text-sm underline hover:text-foreground"
				>
					Try again
				</button>
			</div>
		);
	}

	const items = cart?.items ?? [];

	const itemsContent = items.map((item) => (
		<li key={item.id} className="flex gap-4 py-5">
			{item.product.images?.[0] && (
				<div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
					<Image
						src={item.product.images[0]}
						alt={item.product.name}
						fill
						className="object-cover"
						sizes="80px"
					/>
				</div>
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-start justify-between gap-2">
					<a
						href={`/products/${item.product.slug}`}
						className="font-medium text-foreground text-sm hover:underline"
					>
						{item.product.name}
					</a>
					<span className="shrink-0 font-medium text-foreground text-sm">
						{formatPrice(item.price * item.quantity)}
					</span>
				</div>
				{item.variant && (
					<p className="text-muted-foreground text-xs">
						{item.variant.name}
						{item.variant.options &&
							Object.entries(item.variant.options)
								.map(([k, v]) => ` · ${k}: ${v}`)
								.join("")}
					</p>
				)}
				<div className="mt-auto flex items-center justify-between">
					<div className="flex items-center gap-1">
						<button
							type="button"
							disabled={loading}
							onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
							className="flex size-6 items-center justify-center rounded border border-border text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
							aria-label="Decrease quantity"
						>
							−
						</button>
						<span className="w-8 text-center text-foreground text-sm">
							{item.quantity}
						</span>
						<button
							type="button"
							disabled={loading}
							onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
							className="flex size-6 items-center justify-center rounded border border-border text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
							aria-label="Increase quantity"
						>
							+
						</button>
					</div>
					<button
						type="button"
						disabled={loading}
						onClick={() => handleRemove(item.id)}
						className="text-muted-foreground text-xs transition-colors hover:text-destructive disabled:opacity-40"
					>
						Remove
					</button>
				</div>
			</div>
		</li>
	));

	return (
		<CartPageTemplate
			hasItems={items.length > 0}
			itemCount={itemCount}
			subtotal={cart ? formatPrice(cart.subtotal) : "$0.00"}
			itemsContent={itemsContent}
		/>
	);
});
