import { Slot } from "@radix-ui/react-slot";
import type React from "react";
import { cn } from "~/lib/utils";

export type GridProps = {
	children: React.ReactNode;
	className?: string;
	cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	mdCols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	lgCols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
	rowGap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
	colGap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
	flow?: "row" | "col" | "dense" | "row-dense" | "col-dense";
	rows?: number;
	autoRows?: "auto" | "min" | "max" | "fr";
	autoCols?: "auto" | "min" | "max" | "fr";
	justify?: "start" | "end" | "center" | "between" | "around" | "evenly";
	items?: "start" | "end" | "center" | "baseline" | "stretch";
	asChild?: boolean;
};

export const Grid = ({
	children,
	className,
	cols = 1,
	mdCols,
	lgCols,
	gap = 4,
	rowGap,
	colGap,
	flow,
	rows,
	autoRows,
	autoCols,
	justify,
	items,
	asChild = false,
}: GridProps) => {
	const gridClasses = cn(
		"grid",
		// Columns
		cols === 1 && "grid-cols-1",
		cols === 2 && "grid-cols-2",
		cols === 3 && "grid-cols-3",
		cols === 4 && "grid-cols-4",
		cols === 5 && "grid-cols-5",
		cols === 6 && "grid-cols-6",
		cols === 7 && "grid-cols-7",
		cols === 8 && "grid-cols-8",
		cols === 9 && "grid-cols-9",
		cols === 10 && "grid-cols-10",
		cols === 11 && "grid-cols-11",
		cols === 12 && "grid-cols-12",

		// Medium breakpoint columns
		mdCols === 1 && "md:grid-cols-1",
		mdCols === 2 && "md:grid-cols-2",
		mdCols === 3 && "md:grid-cols-3",
		mdCols === 4 && "md:grid-cols-4",
		mdCols === 5 && "md:grid-cols-5",
		mdCols === 6 && "md:grid-cols-6",
		mdCols === 7 && "md:grid-cols-7",
		mdCols === 8 && "md:grid-cols-8",
		mdCols === 9 && "md:grid-cols-9",
		mdCols === 10 && "md:grid-cols-10",
		mdCols === 11 && "md:grid-cols-11",
		mdCols === 12 && "md:grid-cols-12",

		// Large breakpoint columns
		lgCols === 1 && "lg:grid-cols-1",
		lgCols === 2 && "lg:grid-cols-2",
		lgCols === 3 && "lg:grid-cols-3",
		lgCols === 4 && "lg:grid-cols-4",
		lgCols === 5 && "lg:grid-cols-5",
		lgCols === 6 && "lg:grid-cols-6",
		lgCols === 7 && "lg:grid-cols-7",
		lgCols === 8 && "lg:grid-cols-8",
		lgCols === 9 && "lg:grid-cols-9",
		lgCols === 10 && "lg:grid-cols-10",
		lgCols === 11 && "lg:grid-cols-11",
		lgCols === 12 && "lg:grid-cols-12",

		// Gaps
		gap === 0 && "gap-0",
		gap === 1 && "gap-1",
		gap === 2 && "gap-2",
		gap === 3 && "gap-3",
		gap === 4 && "gap-4",
		gap === 5 && "gap-5",
		gap === 6 && "gap-6",
		gap === 8 && "gap-8",
		gap === 10 && "gap-10",
		gap === 12 && "gap-12",
		gap === 16 && "gap-16",

		// Row Gap
		rowGap === 0 && "gap-y-0",
		rowGap === 1 && "gap-y-1",
		rowGap === 2 && "gap-y-2",
		rowGap === 3 && "gap-y-3",
		rowGap === 4 && "gap-y-4",
		rowGap === 5 && "gap-y-5",
		rowGap === 6 && "gap-y-6",
		rowGap === 8 && "gap-y-8",
		rowGap === 10 && "gap-y-10",
		rowGap === 12 && "gap-y-12",
		rowGap === 16 && "gap-y-16",

		// Column Gap
		colGap === 0 && "gap-x-0",
		colGap === 1 && "gap-x-1",
		colGap === 2 && "gap-x-2",
		colGap === 3 && "gap-x-3",
		colGap === 4 && "gap-x-4",
		colGap === 5 && "gap-x-5",
		colGap === 6 && "gap-x-6",
		colGap === 8 && "gap-x-8",
		colGap === 10 && "gap-x-10",
		colGap === 12 && "gap-x-12",
		colGap === 16 && "gap-x-16",

		// Flow
		flow === "row" && "grid-flow-row",
		flow === "col" && "grid-flow-col",
		flow === "dense" && "grid-flow-dense",
		flow === "row-dense" && "grid-flow-row-dense",
		flow === "col-dense" && "grid-flow-col-dense",

		// Rows
		rows === 1 && "grid-rows-1",
		rows === 2 && "grid-rows-2",
		rows === 3 && "grid-rows-3",
		rows === 4 && "grid-rows-4",
		rows === 5 && "grid-rows-5",
		rows === 6 && "grid-rows-6",

		// Auto Rows
		autoRows === "auto" && "auto-rows-auto",
		autoRows === "min" && "auto-rows-min",
		autoRows === "max" && "auto-rows-max",
		autoRows === "fr" && "auto-rows-fr",

		// Auto Columns
		autoCols === "auto" && "auto-cols-auto",
		autoCols === "min" && "auto-cols-min",
		autoCols === "max" && "auto-cols-max",
		autoCols === "fr" && "auto-cols-fr",

		// Justify Content
		justify === "start" && "justify-start",
		justify === "end" && "justify-end",
		justify === "center" && "justify-center",
		justify === "between" && "justify-between",
		justify === "around" && "justify-around",
		justify === "evenly" && "justify-evenly",

		// Align Items
		items === "start" && "items-start",
		items === "end" && "items-end",
		items === "center" && "items-center",
		items === "baseline" && "items-baseline",
		items === "stretch" && "items-stretch",

		className,
	);

	const Comp = asChild ? Slot : "div";

	return (
		<Comp data-slot="grid" className={gridClasses}>
			{children}
		</Comp>
	);
};
