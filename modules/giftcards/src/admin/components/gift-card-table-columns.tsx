import { DataTableColumnHeader } from "@86d-app/ui/data-table/column-header";
import { createColumnHelper, type useTable } from "@tanstack/react-table";
import type { GiftCardAdminRecord } from "./gift-card-admin-types";
import { formatGiftCardCurrency, formatGiftCardDate } from "./gift-card-format";
import { GiftCardRowActions } from "./gift-card-row-actions";
import { GiftCardStatusBadge } from "./gift-card-status-badge";
import type { giftCardTableFeatures } from "./gift-card-table-model";

const columnHelper = createColumnHelper<
	typeof giftCardTableFeatures,
	GiftCardAdminRecord
>();

function createGiftCardTableColumns(onView: (id: string) => void) {
	return [
		columnHelper.accessor("code", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Code" />
			),
			cell: ({ getValue }) => (
				<span className="font-mono text-xs">{getValue()}</span>
			),
			meta: { label: "Code" },
		}),
		columnHelper.accessor("currentBalance", {
			id: "balance",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Balance" />
			),
			cell: ({ row }) => {
				const card = row.original;
				return (
					<span className="tabular-nums">
						<span className="font-medium text-foreground">
							{formatGiftCardCurrency(card.currentBalance, card.currency)}
						</span>
						{card.currentBalance !== card.initialBalance ? (
							<span className="ml-1 text-muted-foreground text-xs">
								of {formatGiftCardCurrency(card.initialBalance, card.currency)}
							</span>
						) : null}
					</span>
				);
			},
			meta: { label: "Balance" },
		}),
		columnHelper.accessor("status", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ getValue }) => <GiftCardStatusBadge status={getValue()} />,
			meta: { label: "Status" },
		}),
		columnHelper.accessor((card) => card.recipientEmail ?? "", {
			id: "recipient",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Recipient" />
			),
			cell: ({ getValue }) => getValue() || "—",
			meta: { label: "Recipient" },
		}),
		columnHelper.accessor("createdAt", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Created" />
			),
			cell: ({ getValue }) => (
				<span className="tabular-nums">{formatGiftCardDate(getValue())}</span>
			),
			meta: { label: "Created" },
		}),
		columnHelper.display({
			id: "details",
			header: "Details",
			cell: ({ row }) => (
				<GiftCardRowActions card={row.original} onView={onView} />
			),
			enableHiding: false,
			enableSorting: false,
		}),
	];
}

type GiftCardTableColumns = Parameters<
	typeof useTable<typeof giftCardTableFeatures, GiftCardAdminRecord>
>[0]["columns"];

export function getGiftCardTableColumns(
	onView: (id: string) => void,
): GiftCardTableColumns {
	const columns = createGiftCardTableColumns(onView);
	return columns as GiftCardTableColumns;
}
