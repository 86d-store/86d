"use client";

import type { ReactNode } from "react";
import { TableCell, TableRow } from "~/shadcn/table";

export interface DataTableEmptyRowProps {
	colSpan: number;
	children: ReactNode;
}

export function DataTableEmptyRow({
	colSpan,
	children,
}: DataTableEmptyRowProps) {
	return (
		<TableRow className="hover:bg-transparent">
			<TableCell colSpan={colSpan} className="h-auto p-0">
				{children}
			</TableCell>
		</TableRow>
	);
}
