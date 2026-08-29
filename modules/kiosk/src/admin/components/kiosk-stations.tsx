"use client";

import { Button } from "@86d-app/ui/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@86d-app/ui/shadcn/tabs";
import { Text } from "@86d-app/ui/text";
import { View } from "@86d-app/ui/view";
import { useDeferredValue, useEffect, useState } from "react";
import type {
	AdminKioskSession,
	AdminKioskStation,
	AdminKioskStationOption,
} from "./kiosk-admin-types";
import { KIOSK_TABLE_PAGE_SIZE } from "./kiosk-table-model";
import { KioskUnavailableState } from "./kiosk-unavailable-state";
import { SessionDataTable } from "./session-data-table";
import { StationDataTable } from "./station-data-table";
import { StationSheet } from "./station-sheet";
import { useKioskApi } from "./use-kiosk-api";
import {
	type KioskStationTableStateController,
	usePersistedKioskSessionTableState,
	usePersistedKioskStationTableState,
} from "./use-persisted-kiosk-table-state";

type KioskTab = "stations" | "sessions";

function sortingQuery(sorting: Array<{ id: string; desc: boolean }>) {
	const requested = sorting[0];
	return {
		sort: requested?.id,
		direction: requested?.desc ? "desc" : "asc",
	} as const;
}

function StationPanel({
	controller,
	onCreate,
}: {
	controller: KioskStationTableStateController;
	onCreate: () => void;
}) {
	const api = useKioskApi();
	const deferredSearch = useDeferredValue(controller.state.globalFilter);
	const sort = sortingQuery(controller.state.sorting);
	const query = api.listStations.useQuery({
		...(controller.state.activityFilter
			? { isActive: controller.state.activityFilter }
			: {}),
		...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
		...(sort.sort ? { sort: sort.sort } : {}),
		direction: sort.direction,
		page: String(controller.state.pageIndex + 1),
		limit: String(KIOSK_TABLE_PAGE_SIZE),
	}) as {
		data: { stations?: AdminKioskStation[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => unknown;
	};
	const stations = query.data?.stations ?? [];
	const total = query.data?.total ?? 0;

	useEffect(() => {
		if (total === 0 || controller.state.pageIndex === 0) return;
		const lastPage = Math.max(0, Math.ceil(total / KIOSK_TABLE_PAGE_SIZE) - 1);
		if (controller.state.pageIndex > lastPage) {
			controller.setPageIndex(lastPage);
		}
	}, [controller, total]);

	if (query.isError) {
		return (
			<KioskUnavailableState
				kind="stations"
				onRetry={() => void query.refetch()}
			/>
		);
	}

	return (
		<StationDataTable
			stations={stations}
			total={total}
			isLoading={query.isLoading}
			stateController={controller}
			onCreate={onCreate}
		/>
	);
}

function SessionPanel() {
	const api = useKioskApi();
	const controller = usePersistedKioskSessionTableState();
	const stationOptionsQuery = api.listStationOptions.useQuery({}) as {
		data: { stations?: AdminKioskStationOption[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => unknown;
	};
	const deferredSearch = useDeferredValue(controller.state.globalFilter);
	const sort = sortingQuery(controller.state.sorting);
	const query = api.listSessions.useQuery({
		...(controller.state.stationFilter.trim()
			? { stationId: controller.state.stationFilter.trim() }
			: {}),
		...(controller.state.statusFilter
			? { status: controller.state.statusFilter }
			: {}),
		...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
		...(sort.sort ? { sort: sort.sort } : {}),
		direction: sort.direction,
		page: String(controller.state.pageIndex + 1),
		limit: String(KIOSK_TABLE_PAGE_SIZE),
	}) as {
		data: { sessions?: AdminKioskSession[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => unknown;
	};
	const sessions = query.data?.sessions ?? [];
	const total = query.data?.total ?? 0;

	useEffect(() => {
		if (total === 0 || controller.state.pageIndex === 0) return;
		const lastPage = Math.max(0, Math.ceil(total / KIOSK_TABLE_PAGE_SIZE) - 1);
		if (controller.state.pageIndex > lastPage) {
			controller.setPageIndex(lastPage);
		}
	}, [controller, total]);

	if (query.isError || stationOptionsQuery.isError) {
		return (
			<KioskUnavailableState
				kind="sessions"
				onRetry={() => {
					void query.refetch();
					void stationOptionsQuery.refetch();
				}}
			/>
		);
	}

	return (
		<SessionDataTable
			sessions={sessions}
			stationOptions={stationOptionsQuery.data?.stations ?? []}
			total={total}
			isLoading={query.isLoading || stationOptionsQuery.isLoading}
			stateController={controller}
		/>
	);
}

export function KioskStations() {
	const stationController = usePersistedKioskStationTableState();
	const [tab, setTab] = useState<KioskTab>("stations");
	const [showCreate, setShowCreate] = useState(false);

	return (
		<View>
			{showCreate ? (
				<StationSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}

			<View className="mb-6 flex items-center justify-between gap-4">
				<View>
					<Text
						variant="h1"
						className="text-balance font-bold text-2xl text-foreground"
					>
						Kiosk stations
					</Text>
					<Text
						variant="p"
						className="mt-1 text-pretty text-muted-foreground text-sm"
					>
						Manage registration records and review stored session lifecycle
						records.
					</Text>
				</View>
				{tab === "stations" ? (
					<Button type="button" onClick={() => setShowCreate(true)}>
						Add station
					</Button>
				) : null}
			</View>

			<Tabs
				value={tab}
				onValueChange={(value) => {
					if (value === "stations" || value === "sessions") setTab(value);
				}}
			>
				<TabsList variant="line" aria-label="Kiosk records">
					<TabsTrigger value="stations">Stations</TabsTrigger>
					<TabsTrigger value="sessions">Legacy sessions</TabsTrigger>
				</TabsList>
				<TabsContent value="stations" className="pt-4">
					<StationPanel
						controller={stationController}
						onCreate={() => setShowCreate(true)}
					/>
				</TabsContent>
				<TabsContent value="sessions" className="pt-4">
					<SessionPanel />
				</TabsContent>
			</Tabs>
		</View>
	);
}
