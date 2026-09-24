import type * as React from "react";
import { cn } from "~/lib/utils";

interface TableProps extends React.ComponentProps<"table"> {
	containerClassName?: string;
}

function Table({
	className,
	containerClassName,
	onScroll,
	...props
}: TableProps) {
	return (
		<div
			// `relative` makes this the containing block for anything absolutely
			// positioned inside a cell (an `sr-only` label, a tooltip anchor), so it
			// scrolls and clips with the rows instead of stretching the page.
			className={cn("relative w-full overflow-auto", containerClassName)}
			// REMINDER: we are not scrolling the table, but the container
			{...{ onScroll }}
		>
			<table
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			className={cn(
				"bg-primary font-medium text-primary-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			className={cn(
				"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			className={cn(
				"h-10 px-2 text-left align-middle font-medium text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return <td className={cn("p-2 align-middle", className)} {...props} />;
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			className={cn("mt-4 text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
