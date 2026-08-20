"use client";

import { useStoreCreditApi } from "./_hooks";
import { formatCurrency, formatDate, formatReason } from "./_utils";
import StoreCreditTransactionsTemplate from "./store-credit-transactions.mdx";

type Transaction = {
	id: string;
	type: "credit" | "debit";
	amount: number;
	balanceAfter: number;
	reason: string;
	description: string;
	createdAt: string;
};

/**
 * Displays a list of store credit transactions for a customer.
 * Shows credits and debits with amounts, reasons, and dates.
 */
export function StoreCreditTransactions({ limit }: { limit?: number }) {
	const api = useStoreCreditApi();

	const { data, isLoading, error } = api.transactions.useQuery({
		...(limit ? { take: limit } : {}),
	});

	const result = data as Record<string, unknown> | undefined;
	const transactions: Transaction[] =
		(result?.transactions as Transaction[]) ?? [];

	return (
		<StoreCreditTransactionsTemplate
			transactions={transactions}
			isLoading={isLoading}
			error={error ? "Unable to load transaction history." : ""}
			formatCurrency={formatCurrency}
			formatDate={formatDate}
			formatReason={formatReason}
		/>
	);
}
