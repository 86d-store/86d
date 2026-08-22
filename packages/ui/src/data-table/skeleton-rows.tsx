"use client";

import type { ReactNode } from "react";
import { TableCell, TableRow } from "~/core/table";
import { cn } from "~/lib/utils";

export const DATA_TABLE_SKELETON_ROW_KEYS = ["one", "two", "three"] as const;

export interface DataTableSkeletonRowsProps {
	columnIds: string[];
	cellClassName?: (columnId: string) => string | undefined;
	renderCell: (columnId: string) => ReactNode;
}

export function DataTableSkeletonRows({
	columnIds,
	cellClassName,
	renderCell,
}: DataTableSkeletonRowsProps) {
	return DATA_TABLE_SKELETON_ROW_KEYS.map((rowKey) => (
		<TableRow key={rowKey} className="hover:bg-transparent">
			{columnIds.map((columnId) => (
				<TableCell
					key={columnId}
					className={cn(
						"min-w-0 px-3 py-3 align-middle first:pl-4 last:pr-4",
						cellClassName?.(columnId),
					)}
				>
					{renderCell(columnId)}
				</TableCell>
			))}
		</TableRow>
	));
}
