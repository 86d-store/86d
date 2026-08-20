"use client";

import { useTaxApi } from "./_hooks";
import { formatCurrency } from "./_utils";
import TaxEstimateTemplate from "./tax-estimate.mdx";

interface TaxRatePublic {
	name: string;
	rate: number;
	type: "percentage" | "fixed";
	inclusive: boolean;
}

/**
 * Displays applicable tax rates for a given address.
 * Useful on product pages or cart summary to show estimated tax.
 */
export function TaxEstimate({
	country,
	state,
	city,
	postalCode,
}: {
	country: string;
	state: string;
	city?: string;
	postalCode?: string;
}) {
	const api = useTaxApi();

	const query: Record<string, string> = { country, state };
	if (city) query.city = city;
	if (postalCode) query.postalCode = postalCode;

	const { data, isLoading } = api.getApplicableRates.useQuery(query) as {
		data: { rates: TaxRatePublic[] } | undefined;
		isLoading: boolean;
	};

	const rates = data?.rates ?? [];

	return (
		<TaxEstimateTemplate
			isLoading={isLoading}
			rates={rates}
			formatCurrency={formatCurrency}
		/>
	);
}
