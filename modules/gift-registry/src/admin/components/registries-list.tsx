"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import RegistriesListTemplate from "./registries-list.mdx";

const PAGE_SIZE = 20;

interface RegistryListItem {
	id: string;
	customerName: string;
	title: string;
	type: string;
	visibility: string;
	status: string;
	itemCount: number;
	purchasedCount: number;
	eventDate?: string;
	createdAt: string;
}

interface SummaryData {
	totalRegistries: number;
	active: number;
	completed: number;
	archived: number;
	totalItems: number;
	totalPurchased: number;
	totalRevenue: number;
}

const STATUS_COLORS: Record<string, string> = {
	active: "text-green-700 bg-green-50 border-green-200",
	completed: "text-blue-700 bg-blue-50 border-blue-200",
	archived: "text-muted-foreground bg-muted/30 border-border",
};

const TYPE_LABELS: Record<string, string> = {
	wedding: "Wedding",
	baby: "Baby",
	birthday: "Birthday",
	housewarming: "Housewarming",
	holiday: "Holiday",
	other: "Other",
};

function useRegistryApi() {
	const client = useModuleClient();
	return {
		list: client.module("gift-registry").admin["/admin/gift-registry"],
		summary:
			client.module("gift-registry").admin["/admin/gift-registry/summary"],
	};
}

export function RegistriesList() {
	const api = useRegistryApi();
	const [statusFilter, setStatusFilter] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: registriesError,
		refetch: refetchRegistries,
	} = api.list.useQuery(queryInput) as {
		data: { registries: RegistryListItem[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: SummaryData } | undefined;
	};

	if (registriesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load gift registries
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchRegistries()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const registries = listData?.registries ?? [];
	const summary = summaryData?.summary;

	return (
		<RegistriesListTemplate
			registries={registries}
			summary={summary}
			loading={loading}
			statusFilter={statusFilter}
			onStatusChange={setStatusFilter}
			statusColors={STATUS_COLORS}
			typeLabels={TYPE_LABELS}
		/>
	);
}
