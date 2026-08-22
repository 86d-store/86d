"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useStore } from "hooks/use-store";
import { ShoppingCartIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "~/components/ui/button-variants";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ─── Types ──────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

// ─── Loading skeleton ───────────────────────────────────────────────

function CartSkeleton() {
	return (
		<div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
			<Skeleton className="mb-8 h-8 w-32" />
			<div className="flex flex-col gap-8 lg:flex-row">
				<div className="flex-1 space-y-0 divide-y divide-border/40">
					{(["cart-sk-0", "cart-sk-1", "cart-sk-2"] as const).map(
						(skeletonKey) => (
							<div key={skeletonKey} className="flex gap-4 py-6">
								<Skeleton className="h-24 w-24 flex-shrink-0 rounded-lg" />
								<div className="flex flex-1 flex-col gap-2">
									<Skeleton className="h-5 w-48" />
									<Skeleton className="h-4 w-24" />
									<Skeleton className="mt-auto h-8 w-28" />
								</div>
								<Skeleton className="h-5 w-16" />
							</div>
						),
					)}
				</div>
				<div className="lg:w-80">
					<Skeleton className="h-48 rounded-xl" />
				</div>
			</div>
		</div>
	);
}

// ─── Empty state ────────────────────────────────────────────────────

function CartEmpty() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ShoppingCartIcon />
				</EmptyMedia>
				<EmptyTitle>Your cart is empty</EmptyTitle>
				<EmptyDescription>
					Looks like you haven&apos;t added anything yet. Browse our products to
					find something you&apos;ll love.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href="/products" className={buttonVariants()}>
					Continue shopping
				</Link>
			</EmptyContent>
		</Empty>
	);
}

// ─── Cart recommendations ───────────────────────────────────────────

interface TrendingProduct {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
}

function CartRecommendations() {
	const client = useModuleClient();
	const { data, isLoading } = client
		.module("recommendations")
		.store["/recommendations/trending"].useQuery({
			take: "4",
		}) as {
		data: { recommendations: TrendingProduct[] } | undefined;
		isLoading: boolean;
	};

	const items = (data?.recommendations ?? []).filter(
		(item) => item.productSlug && item.productName,
	);

	if (!isLoading && items.length === 0) return null;

	return (
		<section className="mt-16 border-border/40 border-t pt-12">
			<h2 className="mb-6 font-display font-semibold text-foreground text-lg tracking-tight">
				You may also like
			</h2>
			<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
				{isLoading
					? Array.from({ length: 4 }, (_, i) => `cart-rec-skel-${i}`).map(
							(id) => (
								<div key={id}>
									<Skeleton className="aspect-[3/4] w-full rounded-lg" />
									<Skeleton className="mt-3 h-3.5 w-3/4" />
									<Skeleton className="mt-1.5 h-3.5 w-1/3" />
								</div>
							),
						)
					: items.map((item) => (
							<Link
								key={item.productId}
								href={`/products/${item.productSlug}`}
								className="group"
							>
								{item.productImage ? (
									<div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
										<Image
											src={item.productImage}
											alt={item.productName}
											width={300}
											height={400}
											unoptimized
											className="h-full w-full object-cover transition-transform group-hover:scale-105"
										/>
									</div>
								) : (
									<div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-muted">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="text-muted-foreground/30"
											aria-hidden="true"
										>
											<rect width="18" height="18" x="3" y="3" rx="2" />
											<circle cx="9" cy="9" r="2" />
											<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
										</svg>
									</div>
								)}
								<div className="mt-3">
									<p className="truncate text-foreground text-sm group-hover:underline">
										{item.productName}
									</p>
									{item.productPrice != null && (
										<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
											{formatPrice(item.productPrice)}
										</p>
									)}
								</div>
							</Link>
						))}
			</div>
		</section>
	);
}

// ─── Cart item row ──────────────────────────────────────────────────

function CartItemRow({
	item,
	loading,
	onUpdateQty,
	onRemove,
}: {
	item: CartItem;
	loading: boolean;
	onUpdateQty: (id: string, qty: number) => void;
	onRemove: (id: string) => void;
}) {
	const image = item.product.images?.[0];
	const lineTotal = item.price * item.quantity;

	return (
		<div className="flex gap-4 py-6 sm:gap-5">
			{/* Product image */}
			<Link
				href={`/products/${item.product.slug}`}
				className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28"
			>
				{image ? (
					<Image
						src={image}
						alt={item.product.name}
						width={400}
						height={400}
						unoptimized
						className="h-full w-full object-cover object-center"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
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

			{/* Details */}
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<Link
							href={`/products/${item.product.slug}`}
							className="font-medium text-foreground text-sm transition-colors hover:text-foreground/70 sm:text-base"
						>
							{item.product.name}
						</Link>
						{item.variant && (
							<p className="mt-0.5 text-muted-foreground text-xs sm:text-sm">
								{item.variant.options &&
								Object.keys(item.variant.options).length > 0
									? Object.values(item.variant.options).join(" / ")
									: item.variant.name}
							</p>
						)}
						<p className="mt-1 text-muted-foreground text-xs sm:hidden">
							{formatPrice(item.price)}
						</p>
					</div>
					<p className="hidden flex-shrink-0 font-medium text-foreground text-sm tabular-nums sm:block">
						{formatPrice(lineTotal)}
					</p>
				</div>

				<div className="mt-auto flex items-center gap-3 pt-2">
					{/* Quantity controls */}
					<div className="flex items-center rounded-lg border border-border">
						<button
							type="button"
							onClick={() => onUpdateQty(item.id, item.quantity - 1)}
							disabled={loading}
							className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
							aria-label="Decrease quantity"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M5 12h14" />
							</svg>
						</button>
						<span className="min-w-8 text-center text-foreground text-sm tabular-nums">
							{item.quantity}
						</span>
						<button
							type="button"
							onClick={() => onUpdateQty(item.id, item.quantity + 1)}
							disabled={loading}
							className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
							aria-label="Increase quantity"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M5 12h14" />
								<path d="M12 5v14" />
							</svg>
						</button>
					</div>

					<button
						type="button"
						onClick={() => onRemove(item.id)}
						disabled={loading}
						className="text-muted-foreground text-sm transition-colors hover:text-destructive disabled:opacity-40"
					>
						Remove
					</button>

					{/* Mobile line total */}
					<p className="ml-auto font-medium text-foreground text-sm tabular-nums sm:hidden">
						{formatPrice(lineTotal)}
					</p>
				</div>
			</div>
		</div>
	);
}

// ─── Main cart page ─────────────────────────────────────────────────

const CartPageClient = observer(function CartPageClient() {
	const client = useModuleClient();
	const { cart: cartStore } = useStore();

	const {
		data: cart,
		isLoading,
		isError,
		refetch,
	} = client.module("cart").store["/cart/get"].useQuery() as {
		data: CartData | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const removeMutation = client
		.module("cart")
		.store["/cart/items/:id/remove"].useMutation({
			onSettled: () =>
				void client.module("cart").store["/cart/get"].invalidate(),
		});

	const updateMutation = client
		.module("cart")
		.store["/cart/items/:id/update"].useMutation({
			onSettled: () =>
				void client.module("cart").store["/cart/get"].invalidate(),
		});

	const clearMutation = client.module("cart").store["/cart/clear"].useMutation({
		onSettled: () => void client.module("cart").store["/cart/get"].invalidate(),
	});

	const mutating =
		removeMutation.isPending ||
		updateMutation.isPending ||
		clearMutation.isPending;

	const handleUpdateQty = (itemId: string, quantity: number) => {
		if (quantity < 1) {
			removeMutation.mutate({ params: { id: itemId } });
			return;
		}
		updateMutation.mutate({ params: { id: itemId }, quantity });
	};

	const handleRemove = (itemId: string) => {
		removeMutation.mutate({ params: { id: itemId } });
	};

	const handleClear = () => {
		clearMutation.mutate(undefined);
	};

	// Close the drawer if it was open when navigating here
	useEffect(() => {
		cartStore.closeDrawer();
	}, [cartStore]);

	if (isLoading) {
		return <CartSkeleton />;
	}

	if (isError) {
		return (
			<div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your cart.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			</div>
		);
	}

	if (!cart || cart.itemCount === 0) {
		return (
			<>
				<CartEmpty />
				<div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
					<CartRecommendations />
				</div>
			</>
		);
	}

	return (
		<div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<h1 className="font-display text-2xl text-foreground sm:text-3xl">
					Cart
					<span className="ml-2 font-normal text-lg text-muted-foreground">
						({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
					</span>
				</h1>
				<button
					type="button"
					onClick={handleClear}
					disabled={mutating}
					className="text-muted-foreground text-sm transition-colors hover:text-destructive disabled:opacity-40"
				>
					Clear cart
				</button>
			</div>

			<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
				{/* Item list */}
				<div className="flex-1 divide-y divide-border/40 border-border/40 border-t">
					{cart.items.map((item) => (
						<CartItemRow
							key={item.id}
							item={item}
							loading={mutating}
							onUpdateQty={handleUpdateQty}
							onRemove={handleRemove}
						/>
					))}
				</div>

				{/* Order summary */}
				<div className="lg:w-80">
					<div className="sticky top-24 rounded-xl border border-border/50 bg-muted/30 p-5">
						<h2 className="mb-4 font-medium text-foreground text-sm">
							Order summary
						</h2>

						<div className="flex flex-col gap-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Subtotal</span>
								<span className="text-foreground tabular-nums">
									{formatPrice(cart.subtotal)}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Shipping</span>
								<span className="text-muted-foreground text-xs">
									Calculated at checkout
								</span>
							</div>
						</div>

						<div className="mt-4 flex justify-between border-border/40 border-t pt-4">
							<span className="font-bold text-foreground">Estimated total</span>
							<span className="font-bold font-display text-foreground text-lg tabular-nums">
								{formatPrice(cart.subtotal)}
							</span>
						</div>

						<Link
							href="/checkout"
							className="mt-5 block w-full rounded-lg bg-foreground py-3 text-center font-medium text-background text-sm transition-opacity hover:opacity-85"
						>
							Continue to checkout
						</Link>

						<Link
							href="/products"
							className="mt-3 block w-full text-center text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							Continue shopping
						</Link>
					</div>
				</div>
			</div>

			<CartRecommendations />
		</div>
	);
});

export default CartPageClient;
