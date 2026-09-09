"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import { readAccountOverview } from "./account-overview-data";

export function useAccountOverview() {
	const client = useModuleClient();
	const [page, setPage] = useState(1);
	const query = client.module("orders").store["/orders/me"].useQuery({
		page: String(page),
		limit: "5",
	});
	const state = readAccountOverview(query);
	const canGoBack = page > 1 && !query.isFetching;
	const canGoForward =
		state.status === "ready" && page < state.pages && !query.isFetching;

	function handlePrevious() {
		if (canGoBack) setPage((current) => Math.max(1, current - 1));
	}

	function handleNext() {
		if (canGoForward) setPage((current) => current + 1);
	}

	function handleRetry() {
		void query.refetch();
	}

	return {
		state,
		isRefreshing: query.isFetching,
		canGoBack,
		canGoForward,
		onPrevious: handlePrevious,
		onNext: handleNext,
		onRetry: handleRetry,
	};
}
