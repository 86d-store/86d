"use client";

import { useStoreCreditApi } from "./_hooks";
import { formatCurrency } from "./_utils";
import StoreCreditBalanceTemplate from "./store-credit-balance.mdx";

/**
 * Displays the customer's current store credit balance.
 * Shows balance amount, account status, and currency.
 */
export function StoreCreditBalance() {
	const api = useStoreCreditApi();

	const { data, isLoading, error } = api.balance.useQuery({});

	const result = data as Record<string, unknown> | undefined;

	return (
		<StoreCreditBalanceTemplate
			balance={result?.balance as number}
			currency={result?.currency as string}
			status={result?.status as string}
			isLoading={isLoading}
			error={error ? "Unable to load store credit balance." : ""}
			formatCurrency={formatCurrency}
		/>
	);
}
