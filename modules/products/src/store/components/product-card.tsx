"use client";

import { useStoreContext } from "@86d-app/core/client/store-context";
import { memo } from "react";
import {
	normalizeCartQueryData,
	useCartMutation,
	useProductLabels,
	useTrack,
} from "./_hooks";
import type { Product } from "./_types";
import { formatPrice, imageUrl } from "./_utils";
import ProductCardTemplate from "./product-card.mdx";

export type ProductCardProps = {
	product: Product;
	showAddToCart?: boolean;
};

export const ProductCard = memo(function ProductCard({
	product,
	showAddToCart = true,
}: ProductCardProps) {
	const cartApi = useCartMutation();
	const track = useTrack();
	const store = useStoreContext<{
		cart: {
			setItemCount(count: number): void;
			openDrawer(): void;
			setOptimisticCart(
				cart: ReturnType<typeof normalizeCartQueryData> | null,
			): void;
		};
	}>();

	const addToCartMutation = cartApi.addToCart.useMutation({
		onSuccess: (data: {
			cart: { id: string };
			items: {
				id: string;
				productId: string;
				variantId?: string | null;
				quantity: number;
				price: number;
				productName: string;
				productSlug: string;
				productImage?: string | null;
				variantName?: string | null;
				variantOptions?: Record<string, string> | null;
			}[];
			itemCount: number;
			subtotal: number;
		}) => {
			const normalized = normalizeCartQueryData(data);
			store.cart.setOptimisticCart(normalized);
			store.cart.setItemCount(data.itemCount);
			store.cart.openDrawer();
			cartApi.queryClient.setQueryData(
				cartApi.getCart.getQueryKey(),
				normalized,
			);
			track({
				type: "addToCart",
				productId: product.id,
				value: product.price,
				data: { name: product.name, quantity: 1 },
			});
		},
	});

	const labels = useProductLabels(product.id);
	const image = imageUrl(product.images[0]);
	const hasDiscount =
		product.compareAtPrice != null && product.compareAtPrice > product.price;
	const discountPct = hasDiscount
		? Math.round((1 - product.price / (product.compareAtPrice as number)) * 100)
		: 0;

	const handleAddToCart = (e: React.MouseEvent) => {
		e.preventDefault();
		addToCartMutation.mutate({
			productId: product.id,
			quantity: 1,
			price: product.price,
			productName: product.name,
			productSlug: product.slug,
			productImage: image,
		});
	};

	return (
		<ProductCardTemplate
			product={product}
			image={image}
			labels={labels}
			showAddToCart={showAddToCart && product.inventory > 0}
			hasDiscount={hasDiscount}
			discountPct={discountPct}
			priceFormatted={formatPrice(product.price)}
			compareAtPriceFormatted={
				hasDiscount ? formatPrice(product.compareAtPrice as number) : null
			}
			isAddingToCart={addToCartMutation.isPending}
			onAddToCart={handleAddToCart}
		/>
	);
});
