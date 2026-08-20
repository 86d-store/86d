"use client";

import { useProductsApi } from "./_hooks";
import { ProductCard } from "./product-card";
import RelatedProductsTemplate from "./related-products.mdx";

export interface RelatedProductsProps {
	productId: string;
	limit?: number;
	title?: string;
}

export function RelatedProducts({
	productId,
	limit = 4,
	title = "You might also like",
}: RelatedProductsProps) {
	const api = useProductsApi();

	const { data, isLoading } = api.getRelatedProducts.useQuery({
		params: { id: productId },
		limit: String(limit),
	}) as {
		data: { products: import("./_types").Product[] } | undefined;
		isLoading: boolean;
	};

	const products = data?.products ?? [];

	if (isLoading) {
		return (
			<section className="border-border/50 border-t py-12 sm:py-14">
				<h2 className="mb-6 font-display font-semibold text-foreground text-lg tracking-tight sm:text-xl">
					{title}
				</h2>
				<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: limit }, (_, i) => `related-skel-${i}`).map(
						(id) => (
							<div key={id}>
								<div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
								<div className="mt-3 space-y-1.5">
									<div className="h-3.5 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
									<div className="h-3.5 w-1/3 animate-pulse rounded bg-muted-foreground/10" />
								</div>
							</div>
						),
					)}
				</div>
			</section>
		);
	}

	if (products.length === 0) return null;

	const gridContent = (
		<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
			{products.map((product) => (
				<ProductCard key={product.id} product={product} />
			))}
		</div>
	);

	return <RelatedProductsTemplate title={title} gridContent={gridContent} />;
}
