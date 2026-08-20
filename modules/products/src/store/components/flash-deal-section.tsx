"use client";

import { useEffect, useState } from "react";
import { useFlashSalesApi } from "./_hooks";
import { formatPrice } from "./_utils";

interface DealData {
	salePrice: number;
	originalPrice: number;
	discountPercent: number;
	stockRemaining: number | null;
	flashSaleName: string;
	endsAt: string;
}

function getTimeRemaining(endsAt: string) {
	const total = Math.max(0, new Date(endsAt).getTime() - Date.now());
	const seconds = Math.floor((total / 1000) % 60);
	const minutes = Math.floor((total / 1000 / 60) % 60);
	const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
	const days = Math.floor(total / (1000 * 60 * 60 * 24));
	return { days, hours, minutes, seconds, expired: total === 0 };
}

function Countdown({ endsAt }: { endsAt: string }) {
	const [time, setTime] = useState(() => getTimeRemaining(endsAt));

	useEffect(() => {
		const id = setInterval(() => setTime(getTimeRemaining(endsAt)), 1000);
		return () => clearInterval(id);
	}, [endsAt]);

	if (time.expired) {
		return <span className="text-muted-foreground text-xs">Sale ended</span>;
	}

	const parts: string[] = [];
	if (time.days > 0) parts.push(`${time.days}d`);
	parts.push(
		`${String(time.hours).padStart(2, "0")}h`,
		`${String(time.minutes).padStart(2, "0")}m`,
		`${String(time.seconds).padStart(2, "0")}s`,
	);

	return (
		<span className="font-mono font-semibold text-red-500 text-sm tabular-nums">
			{parts.join(" ")}
		</span>
	);
}

export function FlashDealSection({ productId }: { productId: string }) {
	const api = useFlashSalesApi();

	const { data, isLoading, isError } = api.getProductDeal.useQuery({
		productId,
	}) as {
		data: { deal?: DealData | null } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	if (isError || isLoading || !data?.deal) return null;

	const { deal } = data;
	const savings = deal.originalPrice - deal.salePrice;

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
					<span className="font-semibold text-red-600 text-xs dark:text-red-400">
						{deal.flashSaleName}
					</span>
				</div>
				<Countdown endsAt={deal.endsAt} />
			</div>

			<div className="flex flex-wrap items-baseline gap-2">
				<span className="font-bold text-base text-red-600 dark:text-red-400">
					{formatPrice(deal.salePrice)}
				</span>
				<span className="text-muted-foreground text-sm line-through">
					{formatPrice(deal.originalPrice)}
				</span>
				<span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-600 text-xs dark:bg-red-900/40 dark:text-red-400">
					Save {formatPrice(savings)} ({Math.round(deal.discountPercent)}% off)
				</span>
			</div>

			{deal.stockRemaining != null && deal.stockRemaining <= 10 && (
				<p className="mt-1.5 text-orange-600 text-xs dark:text-orange-400">
					Only {deal.stockRemaining} left at this price
				</p>
			)}
		</div>
	);
}
