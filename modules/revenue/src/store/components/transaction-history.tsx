"use client";

import { useState } from "react";
import { useRevenueStoreApi } from "./_hooks";
import TransactionHistoryTemplate from "./transaction-history.mdx";

type PaymentIntentStatus =
	| "pending"
	| "processing"
	| "succeeded"
	| "failed"
	| "cancelled"
	| "refunded";

interface Transaction {
	id: string;
	providerIntentId?: string | undefined;
	orderId?: string | undefined;
	amount: number;
	currency: string;
	status: PaymentIntentStatus;
	createdAt: string;
	updatedAt: string;
}

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
		data:
			| { transactions: Transaction[]; total: number }
			| { status: number }
			| undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const isUnauthorized =
		!isLoading && (data as { status?: number } | undefined)?.status === 401;
	const successData = data as
		| { transactions: Transaction[]; total: number }
		| undefined;
	const transactions = successData?.transactions ?? [];
	const total = successData?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<TransactionHistoryTemplate
			isAuthenticated={isAuthenticated ?? !isUnauthorized}
			isLoading={isLoading}
			isError={isError}
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
