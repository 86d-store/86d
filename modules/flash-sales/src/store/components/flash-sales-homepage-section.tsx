"use client";

import Image from "next/image";
import Link from "next/link";
import { useFlashSalesApi } from "./_hooks";
import { formatPrice } from "./_utils";
import { Countdown } from "./countdown";

interface FlashSaleProduct {
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
}

interface FlashSaleData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	status: string;
	startsAt: string;
	endsAt: string;
	products: FlashSaleProduct[];
}

export interface FlashSalesHomepageSectionProps {
	/** Max number of products to show per sale. Defaults to 4. */
	productLimit?: number;
	/** Max number of sales to show. Defaults to 1. */
	saleLimit?: number;
}

/**
 * Compact flash sales section for embedding in the store homepage.
 * Returns null when there are no active sales — no skeleton, no empty state —
 * so the homepage layout is unaffected when the module is idle.
 */
export function FlashSalesHomepageSection({
	productLimit = 4,
	saleLimit = 1,
}: FlashSalesHomepageSectionProps) {
	const api = useFlashSalesApi();

	const { data, isLoading } = api.listActive.useQuery() as {
		data: { sales: FlashSaleData[] } | undefined;
		isLoading: boolean;
	};

	if (isLoading || !data || data.sales.length === 0) return null;

	const visibleSales = data.sales.slice(0, saleLimit);

	return (
		<div className="space-y-8">
			{visibleSales.map((sale) => {
				const bestDiscount = sale.products.reduce((max, p) => {
					const pct = Math.round(
						((p.originalPrice - p.salePrice) / p.originalPrice) * 100,
					);
					return pct > max ? pct : max;
				}, 0);

				const visibleProducts = sale.products.slice(0, productLimit);

				return (
					<section
						key={sale.id}
						aria-label={`Flash sale: ${sale.name}`}
						className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10"
					>
						{/* Header */}
						<div className="flex flex-wrap items-center justify-between gap-3 border-red-200 border-b px-5 py-4 dark:border-red-900/40">
							<div className="flex items-center gap-3">
								{/* Lightning bolt */}
								<span
									className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white"
									aria-hidden="true"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
									</svg>
								</span>
								<div>
									<div className="flex items-center gap-2">
										<h2 className="font-semibold text-foreground text-sm">
											{sale.name}
										</h2>
										{bestDiscount > 0 && (
											<span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-700 text-xs dark:text-red-400">
												Up to {bestDiscount}% off
											</span>
										)}
									</div>
									{sale.description && (
										<p className="mt-0.5 text-muted-foreground text-xs">
											{sale.description}
										</p>
									)}
								</div>
							</div>
							<Countdown endsAt={sale.endsAt} label="Ends in" />
						</div>

						{/* Product grid */}
						<div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
							{visibleProducts.map((product) => {
								const discountPct = Math.round(
									((product.originalPrice - product.salePrice) /
										product.originalPrice) *
										100,
								);
								const stockRemaining =
									product.stockLimit != null
										? product.stockLimit - product.stockSold
										: null;
								const isSoldOut = stockRemaining != null && stockRemaining <= 0;

								const cardContent = (
									<>
										<span className="absolute top-2 right-2 z-10 rounded-full bg-red-700 px-1.5 py-0.5 font-medium text-white text-xs">
											-{discountPct}%
										</span>
										<div className="relative mb-2.5 aspect-square overflow-hidden rounded-md bg-muted">
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
										{product.productName && (
											<p className="mb-1 truncate font-medium text-foreground text-xs">
												{product.productName}
											</p>
										)}
										<div className="mb-1.5 flex items-baseline gap-1.5">
											<span className="font-semibold text-foreground text-sm">
												{formatPrice(product.salePrice)}
											</span>
											<span className="text-muted-foreground text-xs line-through">
												{formatPrice(product.originalPrice)}
											</span>
										</div>
										{stockRemaining != null && (
											<div>
												<span
													className={`text-xs ${
														isSoldOut
															? "text-muted-foreground"
															: stockRemaining <= 5
																? "text-red-500"
																: "text-muted-foreground"
													}`}
												>
													{isSoldOut ? "Sold out" : `${stockRemaining} left`}
												</span>
												{product.stockLimit != null && (
													<div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
														<div
															className={`h-full rounded-full ${
																isSoldOut
																	? "bg-muted-foreground/40"
																	: stockRemaining <= 5
																		? "bg-red-500"
																		: "bg-green-500"
															}`}
															style={{
																width: `${Math.min(100, (product.stockSold / (product.stockLimit ?? 1)) * 100)}%`,
															}}
														/>
													</div>
												)}
											</div>
										)}
									</>
								);

								return product.productSlug ? (
									<Link
										key={product.id}
										href={`/products/${product.productSlug}`}
										className="relative block overflow-hidden rounded-lg border border-border bg-background p-3 transition-shadow hover:shadow-sm"
									>
										{cardContent}
									</Link>
								) : (
									<div
										key={product.id}
										className="relative overflow-hidden rounded-lg border border-border bg-background p-3 transition-shadow hover:shadow-sm"
									>
										{cardContent}
									</div>
								);
							})}
						</div>

						{/* Footer link */}
						<div className="border-red-200 border-t px-5 py-3 dark:border-red-900/40">
							<Link
								href={`/flash-sales/${sale.slug}`}
								className="inline-flex items-center gap-1.5 text-red-600 text-sm transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
							>
								View all {sale.products.length} deals
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
									<path d="m9 18 6-6-6-6" />
								</svg>
							</Link>
						</div>
					</section>
				);
			})}
		</div>
	);
}
