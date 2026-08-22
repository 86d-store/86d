"use client";

import { useState } from "react";
import { useStoreCreditApi } from "./_hooks";
import { extractError, formatCurrency } from "./_utils";
import StoreCreditApplyTemplate from "./store-credit-apply.mdx";

/**
 * Apply store credits to an order during checkout.
 * Shows current balance and lets the customer choose how much to apply.
 */
export function StoreCreditApply({
	orderTotal,
	onApplied,
}: {
	orderTotal?: number;
	onApplied?: (amountApplied: number, remainingBalance: number) => void;
}) {
	const api = useStoreCreditApi();
	const [error, setError] = useState("");
	const [applied, setApplied] = useState<{
		amount: number;
		remaining: number;
	} | null>(null);

	const { data: balanceData, isLoading: balanceLoading } = api.balance.useQuery(
		{},
	);

	const balanceResult = balanceData as Record<string, unknown> | undefined;
	const balance: number = balanceResult?.balance as number;
	const currency: string = balanceResult?.currency as string;
	const status: string = balanceResult?.status as string;

	const applyMutation = api.apply.useMutation({
		onError: (err: Error) => {
			setError(extractError(err, "Failed to apply store credit."));
		},
		onSuccess: (data: Record<string, unknown>) => {
			const transaction = data.transaction as
				| Record<string, unknown>
				| undefined;
			const amountApplied = transaction?.amount as number;
			const remainingBalance = data.remainingBalance as number;
			setApplied({ amount: amountApplied, remaining: remainingBalance });
			onApplied?.(amountApplied, remainingBalance);
		},
	});

	const maxApplicable =
		orderTotal != null ? Math.min(balance, orderTotal) : balance;

	const handleApply = () => {
		if (maxApplicable <= 0) return;
		setError("");
		setApplied(null);
		applyMutation.mutate({
			amount: maxApplicable,
		});
	};

	return (
		<StoreCreditApplyTemplate
			balance={balance}
			currency={currency}
			status={status}
			maxApplicable={maxApplicable}
			applied={applied}
			error={error}
			isLoading={applyMutation.isPending}
			balanceLoading={balanceLoading}
			onApply={handleApply}
			formatCurrency={formatCurrency}
		/>
	);
}
