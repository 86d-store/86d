"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import WarrantiesListTemplate from "./warranties-list.mdx";

interface ClaimListItem {
	id: string;
	warrantyRegistrationId: string;
	customerId: string;
	customerEmail?: string;
	issueType: string;
	status: string;
	submittedAt: string;
}

interface ClaimSummaryData {
	totalClaims: number;
	submitted: number;
	underReview: number;
	approved: number;
	denied: number;
	inRepair: number;
	resolved: number;
	closed: number;
}

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
	submitted:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	under_review:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	approved:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	in_repair:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	resolved:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	closed: "bg-muted text-muted-foreground",
};

function useWarrantiesApi() {
	const client = useModuleClient();
	return {
		listClaims: client.module("warranties").admin["/admin/warranties/claims"],
		summary:
			client.module("warranties").admin["/admin/warranties/claims/summary"],
	};
}

export function WarrantiesList() {
	const api = useWarrantiesApi();
	const [statusFilter, setStatusFilter] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: claimsError,
		refetch: refetchClaims,
	} = api.listClaims.useQuery(queryInput) as {
		data: { claims: ClaimListItem[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: ClaimSummaryData } | undefined;
	};

	if (claimsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load warranty claims
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchClaims()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const claims = listData?.claims ?? [];
	const summary = summaryData?.summary;

	return (
		<WarrantiesListTemplate
			claims={claims}
			summary={summary}
			loading={loading}
			statusFilter={statusFilter}
			onStatusChange={setStatusFilter}
			statusColors={STATUS_COLORS}
		/>
	);
}
