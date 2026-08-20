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

const SALE_SKELETON_KEYS = ["sale-1", "sale-2"];
const PRODUCT_SKELETON_KEYS = ["prod-1", "prod-2", "prod-3", "prod-4"];

export function FlashSaleListing() {
	const api = useFlashSalesApi();

	const { data, isLoading } = api.listActive.useQuery() as {
		data: { sales: FlashSaleData[] } | undefined;
		isLoading: boolean;
	};

	const sales = data?.sales ?? [];

	if (isLoading) {
		return (
			<div className="space-y-8">
				{SALE_SKELETON_KEYS.map((saleKey) => (
					<div key={saleKey} className="animate-pulse">
						<div className="mb-3 h-6 w-48 rounded bg-muted" />
						<div className="mb-4 h-4 w-72 rounded bg-muted-foreground/10" />
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
							{PRODUCT_SKELETON_KEYS.map((productKey) => (
								<div
									key={`${saleKey}-${productKey}`}
									className="rounded-lg border border-border p-4"
								>
									<div className="mb-3 aspect-square rounded-md bg-muted" />
									<div className="mb-2 h-4 w-20 rounded bg-muted-foreground/10" />
									<div className="h-8 w-full rounded bg-muted" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (sales.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="mb-3 text-muted-foreground/50"
					aria-hidden="true"
				>
					<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
				</svg>
				<p className="font-medium text-foreground text-sm">
					No active flash sales
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check back soon for limited-time deals
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-12">
			{sales.map((sale) => {
				const bestDiscount = sale.products.reduce((max, p) => {
					const pct = Math.round(
						((p.originalPrice - p.salePrice) / p.originalPrice) * 100,
					);
					return pct > max ? pct : max;
				}, 0);

				return (
					<section key={sale.id}>
						<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
							<div>
								<Link
									href={`/flash-sales/${sale.slug}`}
									className="group/link inline-flex items-center gap-2"
								>
									<h2 className="font-semibold text-foreground text-lg transition-colors group-hover/link:text-foreground/80">
										{sale.name}
									</h2>
									{bestDiscount > 0 && (
										<span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 text-xs dark:text-red-400">
											Up to {bestDiscount}% off
										</span>
									)}
								</Link>
								{sale.description && (
									<p className="mt-0.5 text-muted-foreground text-sm">
										{sale.description}
									</p>
								)}
							</div>
							<div className="flex items-center gap-3">
								<Countdown endsAt={sale.endsAt} label="Ends in" />
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
							{sale.products.slice(0, 8).map((product) => {
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
										<div className="absolute top-2 right-2 z-10 rounded-full bg-red-500 px-2 py-0.5 font-medium text-white text-xs">
											-{discountPct}%
										</div>
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
										{product.productName && (
											<p className="mb-1 truncate font-medium text-foreground text-xs">
												{product.productName}
											</p>
										)}
										<div className="mb-2 flex items-baseline gap-2">
											<span className="font-semibold text-foreground text-sm">
												{formatPrice(product.salePrice)}
											</span>
											<span className="text-muted-foreground text-xs line-through">
												{formatPrice(product.originalPrice)}
											</span>
										</div>
										{stockRemaining != null && (
											<div className="mb-2">
												<span
													className={`text-2xs ${isSoldOut ? "text-muted-foreground" : stockRemaining <= 5 ? "text-red-500" : "text-muted-foreground"}`}
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
																width: `${Math.min(100, (product.stockSold / product.stockLimit) * 100)}%`,
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
										className="relative block rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm"
									>
										{cardContent}
									</Link>
								) : (
									<div
										key={product.id}
										className="relative rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm"
									>
										{cardContent}
									</div>
								);
							})}
						</div>

						{sale.products.length > 8 && (
							<div className="mt-4 text-center">
								<Link
									href={`/flash-sales/${sale.slug}`}
									className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-1.5 text-foreground text-xs transition-colors hover:bg-muted"
								>
									View all {sale.products.length} deals
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="12"
										height="12"
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
						)}
					</section>
				);
			})}
		</div>
	);
}
