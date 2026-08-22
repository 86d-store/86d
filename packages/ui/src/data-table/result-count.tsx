"use client";

import { Spinner } from "~/core/spinner";
import { Text } from "~/text";

export interface DataTableResultCountProps {
	isLoading?: boolean;
	isFiltered?: boolean;
	filteredCount: number;
	totalCount: number;
	noun: {
		singular: string;
		plural: string;
	};
}

export function DataTableResultCount({
	isLoading = false,
	isFiltered = false,
	filteredCount,
	totalCount,
	noun,
}: DataTableResultCountProps) {
	return (
		<Text className="hidden items-center gap-1.5 text-muted-foreground text-xs tabular-nums sm:inline-flex">
			{isLoading ? (
				<Spinner className="size-3" />
			) : (
				<span className="font-medium text-foreground">
					{isFiltered ? filteredCount : totalCount}
				</span>
			)}
			{!isLoading && isFiltered ? ` of ${totalCount}` : null}{" "}
			{isLoading || totalCount !== 1 ? noun.plural : noun.singular}
		</Text>
	);
}
