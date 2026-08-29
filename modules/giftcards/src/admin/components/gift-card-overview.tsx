"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useMemo, useState } from "react";
import type {
	GiftCardAdminRecord,
	GiftCardAdminStats,
	GiftCardAdminTransaction,
} from "./gift-card-admin-types";
import { GiftCardDataTable } from "./gift-card-data-table";
import GiftCardOverviewTemplate from "./gift-card-overview.mdx";
import {
	GiftCardDetailContent,
	GiftCardListError,
	GiftCardStatsPanel,
	ReadOnlyNotice,
} from "./gift-card-overview-presentation";
import { getGiftCardServerSort } from "./gift-card-table-model";
import type { GiftCardTableStateController } from "./use-persisted-gift-card-table-state";
import { usePersistedGiftCardTableState } from "./use-persisted-gift-card-table-state";

const PAGE_SIZE = 20;

function useGiftCardAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("gift-cards").admin["/admin/gift-cards"],
		stats: client.module("gift-cards").admin["/admin/gift-cards/stats"],
		get: client.module("gift-cards").admin["/admin/gift-cards/:id"],
		transactions:
			client.module("gift-cards").admin["/admin/gift-cards/:id/transactions"],
	};
}

function DetailPanel({
	cardId,
	onClose,
}: {
	cardId: string;
	onClose: () => void;
}) {
	const api = useGiftCardAdminApi();
	const {
		data: cardData,
		isLoading: cardLoading,
		isError: cardError,
	} = api.get.useQuery({ params: { id: cardId } }) as {
		data: { card: GiftCardAdminRecord } | undefined;
		isLoading: boolean;
		isError: boolean;
	};
	const {
		data: transactionData,
		isLoading: transactionsLoading,
		isError: transactionsError,
	} = api.transactions.useQuery({
		params: { id: cardId },
		take: "50",
		skip: "0",
	}) as {
		data:
			| {
					transactions: GiftCardAdminTransaction[];
					card: GiftCardAdminRecord;
			  }
			| undefined;
		isLoading: boolean;
		isError: boolean;
	};

	return (
		<GiftCardDetailContent
			card={cardData?.card}
			transactions={transactionData?.transactions ?? []}
			isLoading={cardLoading || transactionsLoading}
			isError={cardError || transactionsError}
			onClose={onClose}
		/>
	);
}

export function GiftCardOverview() {
	const api = useGiftCardAdminApi();
	const [skip, setSkip] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const persistedTableState = usePersistedGiftCardTableState();
	const statusFilter = persistedTableState.state.statusFilter;
	const search = persistedTableState.state.globalFilter.trim();
	const { sort, direction } = getGiftCardServerSort(
		persistedTableState.state.sorting,
	);

	const {
		data: listData,
		isLoading: listLoading,
		isError: listError,
	} = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
		...(search ? { search } : {}),
		sort,
		direction,
	}) as {
		data: { cards: GiftCardAdminRecord[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
	};
	const {
		data: statsData,
		isLoading: statsLoading,
		isError: statsError,
	} = api.stats.useQuery({}) as {
		data: { stats: GiftCardAdminStats } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const closeDetail = useCallback(() => setSelectedId(null), []);
	const viewDetail = useCallback((id: string) => setSelectedId(id), []);
	const changeStatusFilter = useCallback(
		(value: string) => {
			persistedTableState.onStatusFilterChange(value);
			setSkip(0);
		},
		[persistedTableState.onStatusFilterChange],
	);
	const changeSorting = useCallback<
		GiftCardTableStateController["onSortingChange"]
	>(
		(updater) => {
			persistedTableState.onSortingChange(updater);
			setSkip(0);
		},
		[persistedTableState.onSortingChange],
	);
	const changeSearch = useCallback<
		GiftCardTableStateController["onGlobalFilterChange"]
	>(
		(updater) => {
			persistedTableState.onGlobalFilterChange(updater);
			setSkip(0);
		},
		[persistedTableState.onGlobalFilterChange],
	);
	const tableStateController = useMemo<GiftCardTableStateController>(
		() => ({
			...persistedTableState,
			onSortingChange: changeSorting,
			onGlobalFilterChange: changeSearch,
		}),
		[persistedTableState, changeSorting, changeSearch],
	);

	if (selectedId) {
		return <DetailPanel cardId={selectedId} onClose={closeDetail} />;
	}

	const tableContent =
		listError || (!listLoading && !listData) ? (
			<GiftCardListError />
		) : (
			<GiftCardDataTable
				cards={listData?.cards ?? []}
				total={listData?.total ?? 0}
				isLoading={listLoading}
				pageSize={PAGE_SIZE}
				skip={skip}
				stateController={tableStateController}
				onStatusFilterChange={changeStatusFilter}
				onView={viewDetail}
				onPreviousPage={() =>
					setSkip((value) => Math.max(0, value - PAGE_SIZE))
				}
				onNextPage={() => setSkip((value) => value + PAGE_SIZE)}
			/>
		);

	return (
		<GiftCardOverviewTemplate
			noticeContent={<ReadOnlyNotice />}
			statsContent={
				<GiftCardStatsPanel
					stats={statsData?.stats}
					isLoading={statsLoading}
					isError={statsError}
				/>
			}
			tableContent={tableContent}
		/>
	);
}
