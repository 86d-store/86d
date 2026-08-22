import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "~/lib/utils";
import {
	EmptyContent as EmptyContentPrimitive,
	EmptyDescription as EmptyDescriptionPrimitive,
	EmptyHeader as EmptyHeaderPrimitive,
	EmptyMedia as EmptyMediaPrimitive,
	Empty as EmptyPrimitive,
	EmptyTitle as EmptyTitlePrimitive,
} from "./shadcn/empty";

const emptyMediaEnter =
	"zoom-in-75 fade-in animate-in fill-mode-both delay-100 duration-300";
const emptyTitleEnter =
	"fade-in slide-in-from-bottom-1 animate-in fill-mode-both delay-150 duration-300";
const emptyDescriptionEnter =
	"fade-in slide-in-from-bottom-1 animate-in fill-mode-both delay-200 duration-300";
const emptyContentEnter =
	"fade-in slide-in-from-bottom-1 animate-in fill-mode-both delay-300 duration-300";

export const emptyMediaVariants = cva(emptyMediaEnter, {
	variants: {
		variant: {
			default: "",
			icon: "",
			destructive:
				"size-auto bg-destructive/10 p-2 text-destructive dark:bg-destructive/20 [&_svg:not([class*='size-'])]:size-9",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export function Empty(props: React.ComponentProps<typeof EmptyPrimitive>) {
	return <EmptyPrimitive {...props} />;
}

export function EmptyHeader(
	props: React.ComponentProps<typeof EmptyHeaderPrimitive>,
) {
	return <EmptyHeaderPrimitive {...props} />;
}

export function EmptyMedia({
	className,
	variant = "default",
	...props
}: Omit<React.ComponentProps<typeof EmptyMediaPrimitive>, "variant"> &
	VariantProps<typeof emptyMediaVariants>) {
	return (
		<EmptyMediaPrimitive
			variant={variant === "destructive" ? "icon" : variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

export function EmptyTitle({
	className,
	...props
}: React.ComponentProps<typeof EmptyTitlePrimitive>) {
	return (
		<EmptyTitlePrimitive
			className={cn(emptyTitleEnter, className)}
			{...props}
		/>
	);
}

export function EmptyDescription({
	className,
	...props
}: React.ComponentProps<typeof EmptyDescriptionPrimitive>) {
	return (
		<EmptyDescriptionPrimitive
			className={cn(emptyDescriptionEnter, className)}
			{...props}
		/>
	);
}

export function EmptyContent({
	className,
	...props
}: React.ComponentProps<typeof EmptyContentPrimitive>) {
	return (
		<EmptyContentPrimitive
			className={cn(emptyContentEnter, className)}
			{...props}
		/>
	);
}
