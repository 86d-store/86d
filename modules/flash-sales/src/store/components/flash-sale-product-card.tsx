"use client";

import { useStoreContext } from "@86d-app/core/client/store-context";
import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useCartMutation } from "./_hooks";
import { formatPrice } from "./_utils";

export type FlashSaleProductData = {
	id: string;
	productId: string;
	productName?: string;
	productSlug?: string;
	productImage?: string;
	salePrice: number;
	originalPrice: number;
	stockLimit: number | null;
	stockSold: number;
	sortOrder: number;
};

export const FlashSaleProductCard = memo(function FlashSaleProductCard({
	product,
}: {
	product: FlashSaleProductData;
}) {
	const cartApi = useCartMutation();
	const store = useStoreContext<{ cart: { openDrawer(): void } }>();

	const discountPct = Math.round(
		((product.originalPrice - product.salePrice) / product.originalPrice) * 100,
	);
	const stockRemaining =
		product.stockLimit != null ? product.stockLimit - product.stockSold : null;
	const isSoldOut = stockRemaining != null && stockRemaining <= 0;

	const addToCartMutation = cartApi.addToCart.useMutation({
		onSuccess: () => {
			void cartApi.getCart.invalidate();
			store.cart.openDrawer();
		},
	});

	const handleAddToCart = (e: React.MouseEvent) => {
		e.preventDefault();
		if (isSoldOut) return;
		addToCartMutation.mutate({
			productId: product.productId,
			quantity: 1,
			price: product.salePrice,
			...(product.productName ? { productName: product.productName } : {}),
			...(product.productSlug ? { productSlug: product.productSlug } : {}),
		});
	};

	const cardContent = (
		<>
			{/* Discount badge */}
			<div className="absolute top-2 right-2 z-10 rounded-full bg-red-500 px-2 py-0.5 font-medium text-white text-xs">
				-{discountPct}%
			</div>

			{/* Product image */}
			<div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-muted">
				{product.productImage && (
					<Image
						src={product.productImage}
						alt={product.productName ?? "Product on sale"}
						fill
						className="object-cover"
						sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
					/>
				)}
			</div>

			{/* Product name */}
			{product.productName && (
				<p className="mb-1.5 truncate font-medium text-foreground text-sm">
					{product.productName}
				</p>
			)}

			{/* Pricing */}
			<div className="mb-2 flex items-baseline gap-2">
				<span className="font-semibold text-foreground text-sm">
					{formatPrice(product.salePrice)}
				</span>
				<span className="text-muted-foreground text-xs line-through">
					{formatPrice(product.originalPrice)}
				</span>
			</div>

			{/* Stock indicator */}
			{stockRemaining != null && (
				<div className="mb-3">
					<div className="mb-1 flex items-center justify-between">
						<span className="text-2xs text-muted-foreground">
							{isSoldOut ? "Sold out" : `${stockRemaining} left`}
						</span>
						{!isSoldOut && product.stockLimit != null && (
							<span className="text-2xs text-muted-foreground tabular-nums">
								{Math.round((product.stockSold / product.stockLimit) * 100)}%
								claimed
							</span>
						)}
					</div>
					{product.stockLimit != null && (
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								className={`h-full rounded-full transition-all ${
									isSoldOut
										? "bg-muted-foreground/40"
										: stockRemaining <= 5
											? "bg-red-500"
											: "bg-green-500"
								}`}
								style={{
									width: `${Math.min(100, (product.stockSold / product.stockLimit) * 100)}%`,
								}}
							/>
						</div>
					)}
				</div>
			)}

			{/* Add to cart */}
			<button
				type="button"
				onClick={handleAddToCart}
				disabled={isSoldOut || addToCartMutation.isPending}
				className="w-full rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs transition-opacity hover:opacity-90 disabled:opacity-40"
			>
				{isSoldOut
					? "Sold out"
					: addToCartMutation.isPending
						? "Adding…"
						: "Add to cart"}
			</button>
		</>
	);

	if (product.productSlug) {
		return (
			<Link
				href={`/products/${product.productSlug}`}
				className="group relative block rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm"
			>
				{cardContent}
			</Link>
		);
	}

	return (
		<div className="group relative rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm">
			{cardContent}
		</div>
	);
});
