"use client";

import Image from "next/image";
import Link from "next/link";
import { useRecommendationsApi } from "./_hooks";
import { formatPrice } from "./_utils";
import RecommendedProductsTemplate from "./recommended-products.mdx";

interface RecommendationItem {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
	score: number;
	strategy: string;
}

export interface RecommendedProductsProps {
	productId: string;
	limit?: number;
	title?: string;
}

export function RecommendedProducts({
	productId,
	limit = 4,
	title = "Recommended for you",
}: RecommendedProductsProps) {
	const api = useRecommendationsApi();

	const { data, isLoading } = api.getForProduct.useQuery({
		params: { productId },
		take: String(limit),
	}) as {
		data: { recommendations: RecommendationItem[] } | undefined;
		isLoading: boolean;
	};

	const recommendations = data?.recommendations ?? [];

	if (isLoading) {
		return (
			<section className="border-border/50 border-t py-12 sm:py-14">
				<h2 className="mb-6 font-display font-semibold text-foreground text-lg tracking-tight sm:text-xl">
					{title}
				</h2>
				<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: limit }, (_, i) => `recommended-skel-${i}`).map(
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

	if (recommendations.length === 0) return null;

	const gridContent = (
		<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
			{recommendations.map((r) => (
				<Link
					key={r.productId}
					href={`/products/${r.productSlug}`}
					className="group"
				>
					{r.productImage ? (
						<div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
							<Image
								src={r.productImage}
								alt={r.productName}
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
						<p className="truncate font-medium text-foreground text-sm group-hover:underline">
							{r.productName}
						</p>
						{r.productPrice != null && (
							<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
								{formatPrice(r.productPrice)}
							</p>
						)}
					</div>
				</Link>
			))}
		</div>
	);

	return (
		<RecommendedProductsTemplate title={title} gridContent={gridContent} />
	);
}
