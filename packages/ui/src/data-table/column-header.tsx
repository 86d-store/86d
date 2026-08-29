"use client";

import {
	ArrowDownIcon,
	ArrowUpIcon,
	CaretUpDownIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Subscribe, type SubscribeSource } from "@tanstack/react-table";
import { Button } from "../button";
import { cn } from "../lib/utils";

type SortDirection = false | "asc" | "desc";
type SortingState = Array<{ id: string; desc: boolean }>;

type SortingAtom = SubscribeSource<SortingState>;

type SortableColumn = {
	id: string;
	getCanSort: () => boolean;
	getIsSorted: () => SortDirection;
	getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
	table: {
		atoms: {
			sorting?: SortingAtom;
		};
	};
};

export interface DataTableColumnHeaderProps
	extends React.ComponentProps<"div"> {
	column: SortableColumn;
	title: string;
}

function sortDirectionForColumn(
	sorting: SortingState | undefined,
	columnId: string,
): SortDirection {
	const entry = sorting?.find((item) => item.id === columnId);
	if (!entry) return false;
	return entry.desc ? "desc" : "asc";
}

function SortHeaderButton({
	column,
	title,
	sorted,
}: {
	column: SortableColumn;
	title: string;
	sorted: SortDirection;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="-ml-2 h-8 gap-1.5 px-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide hover:bg-muted/60 hover:text-foreground data-[state=open]:bg-accent"
			onClick={column.getToggleSortingHandler()}
		>
			<span>{title}</span>
			{sorted === "desc" ? (
				<ArrowDownIcon weight="bold" className="size-3.5 text-foreground" />
			) : sorted === "asc" ? (
				<ArrowUpIcon weight="bold" className="size-3.5 text-foreground" />
			) : (
				<CaretUpDownIcon weight="bold" className="size-3.5 opacity-50" />
			)}
		</Button>
	);
}

export function DataTableColumnHeader({
	column,
	title,
	className,
	...props
}: DataTableColumnHeaderProps) {
	if (!column.getCanSort()) {
		return (
			<div className={cn(className)} {...props}>
				{title}
			</div>
		);
	}

	const sortingAtom = column.table.atoms.sorting;

	return (
		<div className={cn("flex items-center", className)} {...props}>
			{sortingAtom ? (
				<Subscribe
					source={sortingAtom}
					selector={(sorting: SortingState) =>
						sortDirectionForColumn(sorting, column.id)
					}
				>
					{(sorted: SortDirection) => (
						<SortHeaderButton column={column} title={title} sorted={sorted} />
					)}
				</Subscribe>
			) : (
				<SortHeaderButton
					column={column}
					title={title}
					sorted={column.getIsSorted()}
				/>
			)}
		</div>
	);
}
