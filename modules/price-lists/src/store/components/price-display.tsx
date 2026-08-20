"use client";

import { usePriceListsStoreApi } from "./_hooks";
import { formatCurrency } from "./_utils";
import PriceDisplayTemplate from "./price-display.mdx";

interface ResolvedPrice {
	price: number;
	compareAtPrice: number | null;
	priceListId: string;
	priceListName: string;
}

export function PriceDisplay({
	productId,
	currency,
	customerGroupId,
	label,
}: {
	productId: string;
	currency?: string | undefined;
	customerGroupId?: string | undefined;
	label?: string | undefined;
}) {
	const api = usePriceListsStoreApi();

	const query = api.resolvePrice.useQuery({
		params: { productId },
		...(customerGroupId ? { customerGroupId } : {}),
		...(currency ? { currency } : {}),
	}) as {
		data: { price: ResolvedPrice | null } | undefined;
		isLoading: boolean;
	};

	const resolved = query.data?.price;

	if (query.isLoading || !resolved) return null;

	return (
		<PriceDisplayTemplate
			label={label ?? "Your price"}
			price={formatCurrency(resolved.price, currency ?? "USD")}
			compareAtPrice={
				resolved.compareAtPrice != null
					? formatCurrency(resolved.compareAtPrice, currency ?? "USD")
					: null
			}
			priceListName={resolved.priceListName}
		/>
	);
}
