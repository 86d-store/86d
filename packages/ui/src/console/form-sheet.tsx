"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type * as React from "react";
import { Alert, AlertTitle } from "../alert";
import { Button } from "../button";
import { cn } from "../lib/utils";
import { ScrollArea } from "../shadcn/scroll-area";
import {
	SheetClose as SheetClosePrimitive,
	SheetContent as SheetContentPrimitive,
	SheetDescription as SheetDescriptionPrimitive,
	SheetFooter as SheetFooterPrimitive,
	SheetHeader as SheetHeaderPrimitive,
	Sheet as SheetPrimitive,
	SheetTitle as SheetTitlePrimitive,
	SheetTrigger as SheetTriggerPrimitive,
} from "../shadcn/sheet";
import { View } from "../view";

export function FormSheet({
	...props
}: React.ComponentProps<typeof SheetPrimitive>) {
	return <SheetPrimitive data-slot="form-sheet" {...props} />;
}

export function FormSheetTrigger(
	props: React.ComponentProps<typeof SheetTriggerPrimitive>,
) {
	return <SheetTriggerPrimitive data-slot="form-sheet-trigger" {...props} />;
}

export interface FormSheetContentProps
	extends Omit<
		React.ComponentProps<typeof SheetContentPrimitive>,
		"render" | "onSubmit"
	> {
	onSubmit: () => void;
	size?: "md" | "lg" | undefined;
}

export function FormSheetContent({
	className,
	children,
	onSubmit,
	size = "lg",
	side = "right",
	...props
}: FormSheetContentProps) {
	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		onSubmit();
	};

	return (
		<SheetContentPrimitive
			{...props}
			side={side}
			data-slot="form-sheet-content"
			className={cn(
				"flex flex-col gap-0",
				size === "lg" ? "max-w-lg!" : "max-w-md!",
				className,
			)}
			render={<form onSubmit={handleSubmit} />}
		>
			{children}
		</SheetContentPrimitive>
	);
}

export function FormSheetHeader(
	props: React.ComponentProps<typeof SheetHeaderPrimitive>,
) {
	return <SheetHeaderPrimitive data-slot="form-sheet-header" {...props} />;
}

export function FormSheetTitle(
	props: React.ComponentProps<typeof SheetTitlePrimitive>,
) {
	return <SheetTitlePrimitive data-slot="form-sheet-title" {...props} />;
}

export function FormSheetDescription(
	props: React.ComponentProps<typeof SheetDescriptionPrimitive>,
) {
	return (
		<SheetDescriptionPrimitive data-slot="form-sheet-description" {...props} />
	);
}

export function FormSheetBody({
	className,
	children,
	...props
}: React.ComponentProps<typeof ScrollArea>) {
	return (
		<ScrollArea
			className={cn("min-h-0 flex-1 border-border border-t", className)}
			{...props}
		>
			<View className="space-y-6 p-4">{children}</View>
		</ScrollArea>
	);
}

export function FormSheetFooter({
	className,
	...props
}: React.ComponentProps<typeof SheetFooterPrimitive>) {
	return (
		<SheetFooterPrimitive
			data-slot="form-sheet-footer"
			className={cn("gap-4 border-t pt-4", className)}
			{...props}
		/>
	);
}

export function FormSheetClose({
	children = "Cancel",
	...props
}: React.ComponentProps<typeof SheetClosePrimitive>) {
	return (
		<SheetClosePrimitive
			{...props}
			render={<Button type="button" variant="secondary" />}
		>
			{children}
		</SheetClosePrimitive>
	);
}

export interface FormSheetErrorProps {
	children: React.ReactNode;
}

export function FormSheetError({ children }: FormSheetErrorProps) {
	if (!children) {
		return null;
	}

	return (
		<Alert variant="destructive">
			<WarningCircleIcon weight="bold" />
			<AlertTitle>{children}</AlertTitle>
		</Alert>
	);
}
