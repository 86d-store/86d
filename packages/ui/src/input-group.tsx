"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Spinner } from "~/core/spinner";
import { cn } from "~/lib/utils";
import {
	InputGroupAddon as InputGroupAddonPrimitive,
	InputGroupButton as InputGroupButtonPrimitive,
	InputGroupInput as InputGroupInputPrimitive,
	InputGroup as InputGroupPrimitive,
	InputGroupTextarea as InputGroupTextareaPrimitive,
	InputGroupText as InputGroupTextPrimitive,
} from "./core/input-group";

const inputGroupVariants = cva(
	"aria-invalid:border-border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:has-[[data-slot=input-group-control]:focus-visible]:border-border-destructive aria-invalid:has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/40",
	{
		variants: {
			variant: {
				default: "h-10",
				muted:
					"h-10 border-muted/90 bg-black/5 font-mono shadow-none dark:bg-muted/60",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface InputGroupProps
	extends React.ComponentProps<typeof InputGroupPrimitive>,
		VariantProps<typeof inputGroupVariants> {}

export function InputGroup({ className, variant, ...props }: InputGroupProps) {
	return (
		<InputGroupPrimitive
			className={cn(inputGroupVariants({ variant }), className)}
			{...props}
		/>
	);
}

const inputGroupAddonInlineStartClassName =
	"w-auto min-w-8 [&>svg]:!transition-all [&>svg]:duration-300 [&>svg]:ease-in-out group-focus-within/input-group:[&>svg]:text-foreground! group-hover/input-group:[&>svg]:text-neutral-700 group-aria-invalid/input-group:[&>svg]:text-destructive!";

export function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<typeof InputGroupAddonPrimitive>) {
	return (
		<InputGroupAddonPrimitive
			align={align}
			className={cn(
				align === "inline-start"
					? inputGroupAddonInlineStartClassName
					: undefined,
				className,
			)}
			{...props}
		/>
	);
}

export function InputGroupButton({
	className,
	...props
}: React.ComponentProps<typeof InputGroupButtonPrimitive>) {
	return <InputGroupButtonPrimitive className={cn("", className)} {...props} />;
}

export function InputGroupInput({
	className,
	...props
}: React.ComponentProps<typeof InputGroupInputPrimitive>) {
	return <InputGroupInputPrimitive className={cn("", className)} {...props} />;
}

export function InputGroupText({
	className,
	...props
}: React.ComponentProps<typeof InputGroupTextPrimitive>) {
	return <InputGroupTextPrimitive className={cn("", className)} {...props} />;
}

export function InputGroupValue({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="input-group-value"
			className={cn("min-w-0 flex-1 truncate px-2.5 py-1 text-sm", className)}
			{...props}
		/>
	);
}

export interface InputGroupTextareaProps
	extends React.ComponentProps<typeof InputGroupTextareaPrimitive> {
	loading?: boolean;
}

export function InputGroupTextarea({
	className,
	loading,
	...props
}: InputGroupTextareaProps) {
	return (
		<>
			<InputGroupTextareaPrimitive
				className={cn(loading ? "pr-10" : undefined, className)}
				{...props}
			/>
			{loading ? (
				<Spinner className="absolute right-2 bottom-2 z-10 text-muted-foreground" />
			) : null}
		</>
	);
}
