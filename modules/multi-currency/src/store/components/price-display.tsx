"use client";

import { useCurrencyApi } from "./_hooks";
import PriceDisplayTemplate from "./price-display.mdx";

interface ConvertedResult {
	amount: number;
	formatted: string;
	currency: string;
}

export interface PriceDisplayProps {
	/** Product ID for price override lookup */
	productId?: string | undefined;
	/** Base price in cents (smallest unit of base currency) */
	basePriceInCents: number;
	/** Target currency code (ISO 4217) */
	currencyCode?: string | undefined;
	/** Compare-at price in cents (for sale display) */
	compareAtPriceInCents?: number | undefined;
	/** Additional CSS class for the container */
	className?: string | undefined;
}

export function PriceDisplay({
	productId,
	basePriceInCents,
	currencyCode,
	compareAtPriceInCents,
	className,
}: PriceDisplayProps) {
	const api = useCurrencyApi();

	const priceQuery = currencyCode
		? productId
			? (api.productPrice.useMutation() as unknown as {
					data: ConvertedResult | undefined;
					isLoading: boolean;
				})
			: (api.convert.useMutation() as unknown as {
					data: ConvertedResult | undefined;
					isLoading: boolean;
				})
		: { data: undefined, isLoading: false };

	// If no currency code, show base price
	if (!currencyCode) {
		const formatted = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(basePriceInCents / 100);

		const compareFormatted = compareAtPriceInCents
			? new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
				}).format(compareAtPriceInCents / 100)
			: undefined;

		return (
			<PriceDisplayTemplate
				price={formatted}
				compareAtPrice={compareFormatted}
				isLoading={false}
				className={className}
			/>
		);
	}

	const price = priceQuery.data;

	return (
		<PriceDisplayTemplate
			price={price?.formatted}
			compareAtPrice={undefined}
			isLoading={priceQuery.isLoading}
			className={className}
		/>
	);
}
