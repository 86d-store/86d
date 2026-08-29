import { DataTableColumnHeader } from "@86d-app/ui/data-table/column-header";
import { Text } from "@86d-app/ui/text";
import { createColumnHelper, type useTable } from "@tanstack/react-table";
import type { AdminKioskSession } from "./kiosk-admin-types";
import type { kioskTableFeatures } from "./kiosk-table-model";
import {
	formatKioskDate,
	SessionStatusBadge,
} from "./kiosk-table-presentation";

const columnHelper = createColumnHelper<
	typeof kioskTableFeatures,
	AdminKioskSession
>();

function createSessionTableColumns(stationNames: ReadonlyMap<string, string>) {
	return [
		columnHelper.accessor("id", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Session" />
			),
			cell: ({ getValue }) => (
				<Text className="font-mono text-muted-foreground text-xs">
					{getValue().slice(0, 8)}…
				</Text>
			),
			meta: { label: "Session" },
		}),
		columnHelper.accessor("stationId", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Station" />
			),
			cell: ({ getValue }) => (
				<Text className="text-foreground text-xs">
					{stationNames.get(getValue()) ?? getValue().slice(0, 8)}
				</Text>
			),
			meta: { label: "Station" },
			enableSorting: false,
		}),
		columnHelper.accessor("status", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ getValue }) => <SessionStatusBadge status={getValue()} />,
			meta: { label: "Status" },
		}),
		columnHelper.accessor("startedAt", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Started" />
			),
			cell: ({ getValue }) => (
				<Text className="text-muted-foreground text-xs tabular-nums">
					{formatKioskDate(getValue())}
				</Text>
			),
			meta: { label: "Started" },
		}),
	];
}

type SessionTableColumns = Parameters<
	typeof useTable<typeof kioskTableFeatures, AdminKioskSession>
>[0]["columns"];

export function getSessionTableColumns(
	stationNames: ReadonlyMap<string, string>,
): SessionTableColumns {
	return createSessionTableColumns(stationNames) as SessionTableColumns;
}
