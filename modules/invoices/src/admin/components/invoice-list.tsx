"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useState } from "react";
import InvoiceListTemplate from "./invoice-list.mdx";

interface InvoiceItem {
	id: string;
	invoiceNumber: string;
	customerName?: string;
	guestEmail?: string;
	status: string;
	total: number;
	amountDue: number;
	currency: string;
	dueDate?: string;
	createdAt: string;
}

function useInvoicesApi() {
	const client = useModuleClient();
	return {
		list: client.module("invoices").admin["/admin/invoices"],
		deleteInvoice:
			client.module("invoices").admin["/admin/invoices/:id/delete"],
		bulkAction: client.module("invoices").admin["/admin/invoices/bulk"],
	};
}

export function InvoiceList() {
	const api = useInvoicesApi();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");

	const queryInput: Record<string, string | number> = {
		page,
		limit: 20,
	};
	if (search) queryInput.search = search;
	if (status) queryInput.status = status;

	const {
		data,
		isLoading: loading,
		isError: invoicesError,
		refetch,
	} = api.list.useQuery(queryInput) as {
		data: { invoices: InvoiceItem[]; total: number; pages: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deleteMutation = (
		api.deleteInvoice as {
			useMutation: () => {
				mutateAsync: (p: { id: string }) => Promise<void>;
			};
		}
	).useMutation();

	const handleDelete = useCallback(
		async (id: string) => {
			if (!confirm("Delete this invoice?")) return;
			await deleteMutation.mutateAsync({ id });
			refetch();
		},
		[deleteMutation, refetch],
	);

	if (invoicesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load invoices
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<InvoiceListTemplate
			invoices={data?.invoices ?? []}
			total={data?.total ?? 0}
			pages={data?.pages ?? 1}
			page={page}
			loading={loading}
			search={search}
			status={status}
			onPageChange={setPage}
			onSearchChange={setSearch}
			onStatusChange={setStatus}
			onDelete={handleDelete}
		/>
	);
}
