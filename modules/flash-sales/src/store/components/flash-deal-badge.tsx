"use client";

import { useFlashSalesApi } from "./_hooks";
import { formatPrice } from "./_utils";
import { Countdown } from "./countdown";

export interface FlashDealBadgeProps {
	productId: string;
}

interface DealData {
	productId: string;
	salePrice: number;
	originalPrice: number;
	discountPercent: number;
	stockLimit: number | null;
	stockSold: number;
	stockRemaining: number | null;
	flashSaleId: string;
	flashSaleName: string;
	endsAt: string;
}

/**
 * Embeddable badge for product pages. Shows flash sale pricing,
 * countdown, and stock remaining when a product is in an active sale.
 */
export function FlashDealBadge({ productId }: FlashDealBadgeProps) {
	const api = useFlashSalesApi();

	const { data, isLoading } = api.getProductDeal.useQuery({
		productId,
	}) as {
		data: { deal: DealData | null } | undefined;
		isLoading: boolean;
	};

	if (isLoading || !data?.deal) return null;

	const { deal } = data;

	return (
		<div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5">
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
						className="text-red-500"
						aria-hidden="true"
					>
						<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
					</svg>
					<span className="font-medium text-red-700 text-xs dark:text-red-300">
						{deal.flashSaleName}
					</span>
				</div>
				<span className="rounded-full bg-red-700 px-1.5 py-0.5 font-medium text-2xs text-white">
					-{deal.discountPercent}%
				</span>
			</div>

			<div className="mb-2 flex items-baseline gap-2">
				<span className="font-bold text-foreground text-lg">
					{formatPrice(deal.salePrice)}
				</span>
				<span className="text-muted-foreground text-sm line-through">
					{formatPrice(deal.originalPrice)}
				</span>
			</div>

			<div className="flex items-center justify-between gap-2">
				<Countdown endsAt={deal.endsAt} />
				{deal.stockRemaining != null && (
					<span
						className={`text-xs ${
							deal.stockRemaining <= 5
								? "font-medium text-red-600 dark:text-red-400"
								: "text-muted-foreground"
						}`}
					>
						{deal.stockRemaining <= 0
							? "Sold out"
							: `${deal.stockRemaining} left`}
					</span>
				)}
			</div>
		</div>
	);
}
