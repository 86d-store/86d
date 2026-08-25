"use client";

import { useState } from "react";
import { useRevenueStoreApi } from "./_hooks";
import TransactionHistoryTemplate from "./transaction-history.mdx";
import { resolveTransactionHistoryQuery } from "./transaction-history-state";

export function TransactionHistory({
	isAuthenticated,
}: {
	isAuthenticated?: boolean | undefined;
}) {
	const api = useRevenueStoreApi();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<string>("");
	const pageSize = 10;

	const query: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (statusFilter) query.status = statusFilter;

	const { data, isLoading, isError } = api.listTransactions.useQuery(query) as {
		data: unknown;
		isLoading: boolean;
		isError: boolean;
	};

	const queryState = resolveTransactionHistoryQuery({
		data,
		isError,
		isLoading,
	});
	const transactionPage =
		queryState.status === "ready" ? queryState.data : undefined;
	const transactions = transactionPage?.transactions ?? [];
	const total = transactionPage?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<TransactionHistoryTemplate
			isAuthenticated={
				isAuthenticated ?? queryState.status !== "unauthenticated"
			}
			isLoading={queryState.status === "loading"}
			isError={queryState.status === "unavailable"}
			transactions={transactions}
			total={total}
			page={page}
			totalPages={totalPages}
			statusFilter={statusFilter}
			onStatusChange={(s: string) => {
				setStatusFilter(s);
				setPage(1);
			}}
			onPageChange={setPage}
		/>
	);
}
