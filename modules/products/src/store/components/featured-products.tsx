"use client";

import Link from "next/link";
import { useProductsApi } from "./_hooks";
import FeaturedProductsTemplate from "./featured-products.mdx";
import { ProductCard } from "./product-card";

export interface FeaturedProductsProps {
	limit?: number;
	title?: string;
}

export function FeaturedProducts({
	limit = 4,
	title = "Featured Products",
}: FeaturedProductsProps) {
	const api = useProductsApi();
	const { data, isLoading, isError } = api.getFeaturedProducts.useQuery({
		limit: String(limit),
	}) as {
		data: { products: import("./_types").Product[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const products = data?.products ?? [];

	// Silently hide on error — homepage sections are non-critical
	if (isError) return null;

	if (isLoading) {
		return (
			<section className="py-12 sm:py-14">
				<div className="mb-6 flex items-baseline justify-between">
					<h2 className="font-display font-semibold text-foreground text-lg tracking-tight sm:text-xl">
						{title}
					</h2>
				</div>
				<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: limit }, (_, i) => `featured-skel-${i}`).map(
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

	const viewAllLink = (
		<Link
			href="/products"
			className="text-muted-foreground text-sm transition-colors hover:text-foreground"
		>
			View all
		</Link>
	);

	const gridContent = (
		<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
			{products.map((product) => (
				<ProductCard key={product.id} product={product} />
			))}
		</div>
	);

	return (
		<FeaturedProductsTemplate
			title={title}
			viewAllLink={viewAllLink}
			gridContent={gridContent}
		/>
	);
}
