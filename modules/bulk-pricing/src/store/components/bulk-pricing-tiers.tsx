"use client";

import { useBulkPricingApi } from "./_hooks";
import { formatPrice } from "./_utils";
import BulkPricingTiersTemplate from "./bulk-pricing-tiers.mdx";

interface PricingTier {
	minQuantity: number;
	maxQuantity?: number | undefined;
	discountType: "percentage" | "fixed_amount" | "fixed_price";
	discountValue: number;
	label?: string | undefined;
}

interface TierPreview {
	tier: PricingTier;
	unitPrice: number;
	savingsPercent: number;
}

export interface BulkPricingTiersProps {
	/** Product ID to show tiers for */
	productId: string;
	/** Base price in cents */
	basePriceInCents: number;
	/** Section title */
	title?: string | undefined;
	/** Currently selected quantity (highlights the active tier) */
	quantity?: number | undefined;
}

export function BulkPricingTiers({
	productId,
	basePriceInCents,
	title = "Volume pricing",
	quantity,
}: BulkPricingTiersProps) {
	const api = useBulkPricingApi();

	const { data, isLoading } = api.getProductTiers.useQuery({
		params: { productId },
		basePrice: String(basePriceInCents),
	}) as {
		data: { tiers: TierPreview[] } | undefined;
		isLoading: boolean;
	};

	const tiers = data?.tiers ?? [];

	if (!isLoading && tiers.length === 0) {
		return null;
	}

	const rows = tiers.map((tp) => {
		const t = tp.tier;
		const rangeLabel =
			t.label ??
			(t.maxQuantity
				? `${t.minQuantity}–${t.maxQuantity}`
				: `${t.minQuantity}+`);
		const isActive =
			quantity != null &&
			quantity >= t.minQuantity &&
			(t.maxQuantity == null || quantity <= t.maxQuantity);

		return {
			key: `${t.minQuantity}-${t.maxQuantity ?? "up"}`,
			range: rangeLabel,
			unitPrice: formatPrice(tp.unitPrice),
			savings: `${Math.round(tp.savingsPercent)}%`,
			isActive,
		};
	});

	return (
		<BulkPricingTiersTemplate
			title={title}
			basePrice={formatPrice(basePriceInCents)}
			rows={rows}
			isLoading={isLoading}
		/>
	);
}
