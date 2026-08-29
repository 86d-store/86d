import { DataTableColumnHeader } from "@86d-app/ui/data-table/column-header";
import { Text } from "@86d-app/ui/text";
import { createColumnHelper, type useTable } from "@tanstack/react-table";
import type { AdminKioskStation } from "./kiosk-admin-types";
import type { kioskTableFeatures } from "./kiosk-table-model";
import { StationRegistrationBadge } from "./kiosk-table-presentation";
import { StationRowActions } from "./station-row-actions";

const columnHelper = createColumnHelper<
	typeof kioskTableFeatures,
	AdminKioskStation
>();

function createStationTableColumns() {
	return [
		columnHelper.accessor("name", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ getValue }) => (
				<Text className="font-medium text-foreground">{getValue()}</Text>
			),
			meta: { label: "Name" },
		}),
		columnHelper.accessor((station) => station.location ?? "", {
			id: "location",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Location" />
			),
			cell: ({ getValue }) => (
				<Text className="text-muted-foreground text-xs">
					{getValue() || "—"}
				</Text>
			),
			meta: { label: "Location" },
		}),
		columnHelper.accessor("isActive", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Registration" />
			),
			cell: ({ getValue }) => <StationRegistrationBadge enabled={getValue()} />,
			meta: { label: "Registration" },
		}),
		columnHelper.display({
			id: "actions",
			header: "Actions",
			cell: ({ row }) => <StationRowActions station={row.original} />,
			enableHiding: false,
			enableSorting: false,
		}),
	];
}

type StationTableColumns = Parameters<
	typeof useTable<typeof kioskTableFeatures, AdminKioskStation>
>[0]["columns"];

export function getStationTableColumns(): StationTableColumns {
	return createStationTableColumns() as StationTableColumns;
}
