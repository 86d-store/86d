"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import OverdueListTemplate from "./overdue-list.mdx";

interface OverdueInvoice {
	id: string;
	invoiceNumber: string;
	customerName?: string;
	guestEmail?: string;
	total: number;
	amountDue: number;
	currency: string;
	dueDate?: string;
}

function useOverdueApi() {
	const client = useModuleClient();
	return {
		overdue: client.module("invoices").admin["/admin/invoices/overdue"],
	};
}

export function OverdueList() {
	const api = useOverdueApi();

	const {
		data,
		isLoading: loading,
		isError: overdueError,
		refetch: refetchOverdue,
	} = api.overdue.useQuery({}) as {
		data: { invoices: OverdueInvoice[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (overdueError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load overdue invoices
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchOverdue()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<OverdueListTemplate
			invoices={data?.invoices ?? []}
			total={data?.total ?? 0}
			loading={loading}
		/>
	);
}
