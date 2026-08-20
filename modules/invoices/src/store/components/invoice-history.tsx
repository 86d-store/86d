"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import InvoiceHistoryTemplate from "./invoice-history.mdx";

interface InvoiceItem {
	id: string;
	invoiceNumber: string;
	status: string;
	total: number;
	amountDue: number;
	currency: string;
	dueDate?: string;
	createdAt: string;
}

function useInvoicesStoreApi() {
	const client = useModuleClient();
	return {
		list: client.module("invoices").store["/invoices/me"],
	};
}

export function InvoiceHistory() {
	const api = useInvoicesStoreApi();
	const [page, setPage] = useState(1);

	const { data, isLoading: loading } = api.list.useQuery({
		page,
		limit: 10,
	}) as {
		data: { invoices: InvoiceItem[]; total: number; pages: number } | undefined;
		isLoading: boolean;
	};

	return (
		<InvoiceHistoryTemplate
			invoices={data?.invoices ?? []}
			total={data?.total ?? 0}
			pages={data?.pages ?? 1}
			page={page}
			loading={loading}
			onPageChange={setPage}
		/>
	);
}
