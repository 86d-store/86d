"use client";

import { useBulkPricingApi } from "./_hooks";
import { formatPrice } from "./_utils";

interface TierPreview {
	tier: {
		minQuantity: number;
		maxQuantity?: number | undefined;
		label?: string | undefined;
	};
	unitPrice: number;
	savingsPercent: number;
}

export function BulkPricingSection({
	productId,
	basePriceInCents,
	quantity,
}: {
	productId: string;
	basePriceInCents: number;
	quantity?: number;
}) {
	const api = useBulkPricingApi();

	const { data, isLoading, isError } = api.getProductTiers.useQuery({
		params: { productId },
		query: { basePrice: basePriceInCents },
	}) as {
		data: { tiers?: TierPreview[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	if (isError || (!isLoading && !data?.tiers?.length)) return null;

	const tiers = data?.tiers ?? [];

	if (isLoading) {
		return <div className="mt-1 h-16 animate-pulse rounded-lg bg-muted/60" />;
	}

	return (
		<div className="mt-1 rounded-lg border border-border bg-muted/20 p-3">
			<p className="mb-2 font-medium text-foreground text-xs">Volume pricing</p>
			<div className="flex flex-col gap-1">
				{tiers.map((tp) => {
					const t = tp.tier;
					const rangeLabel =
						t.label ??
						(t.maxQuantity
							? `${t.minQuantity}–${t.maxQuantity} units`
							: `${t.minQuantity}+ units`);
					const isActive =
						quantity != null &&
						quantity >= t.minQuantity &&
						(t.maxQuantity == null || quantity <= t.maxQuantity);

					return (
						<div
							key={`${t.minQuantity}-${t.maxQuantity ?? "up"}`}
							className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
								isActive
									? "bg-foreground text-background"
									: "text-muted-foreground"
							}`}
						>
							<span>{rangeLabel}</span>
							<span className="font-medium">
								{formatPrice(tp.unitPrice)} each
								{tp.savingsPercent > 0 && (
									<span
										className={`ml-1.5 ${isActive ? "text-background/70" : "text-status-success"}`}
									>
										{Math.round(tp.savingsPercent)}% off
									</span>
								)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
