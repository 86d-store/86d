"use client";

import type * as React from "react";
import { cn } from "./lib/utils";
import {
	DropdownMenuCheckboxItem as DropdownMenuCheckboxItemPrimitive,
	DropdownMenuContent as DropdownMenuContentPrimitive,
	DropdownMenuGroup as DropdownMenuGroupPrimitive,
	DropdownMenuItem as DropdownMenuItemPrimitive,
	DropdownMenuLabel as DropdownMenuLabelPrimitive,
	DropdownMenuPortal as DropdownMenuPortalPrimitive,
	DropdownMenu as DropdownMenuPrimitive,
	DropdownMenuRadioGroup as DropdownMenuRadioGroupPrimitive,
	DropdownMenuRadioItem as DropdownMenuRadioItemPrimitive,
	DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
	DropdownMenuShortcut as DropdownMenuShortcutPrimitive,
	DropdownMenuSubContent as DropdownMenuSubContentPrimitive,
	DropdownMenuSub as DropdownMenuSubPrimitive,
	DropdownMenuSubTrigger as DropdownMenuSubTriggerPrimitive,
	DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
} from "./shadcn/dropdown-menu";

export function DropdownMenu(
	props: React.ComponentProps<typeof DropdownMenuPrimitive>,
) {
	return <DropdownMenuPrimitive {...props} />;
}

export function DropdownMenuPortal(
	props: React.ComponentProps<typeof DropdownMenuPortalPrimitive>,
) {
	return <DropdownMenuPortalPrimitive {...props} />;
}

export function DropdownMenuTrigger(
	props: React.ComponentProps<typeof DropdownMenuTriggerPrimitive>,
) {
	return <DropdownMenuTriggerPrimitive {...props} />;
}

const destructivePopupOverrides =
	"**:data-[variant=destructive]:text-destructive! **:data-[variant=destructive]:**:text-destructive! **:data-[variant=destructive]:*:[svg]:text-destructive! **:data-[variant=destructive]:data-highlighted:text-destructive! **:data-[variant=destructive]:data-highlighted:bg-destructive/10! **:data-[variant=destructive]:focus:text-destructive! **:data-[variant=destructive]:focus:bg-destructive/10!";

export function DropdownMenuContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuContentPrimitive>) {
	return (
		<DropdownMenuContentPrimitive
			className={cn(destructivePopupOverrides, className)}
			{...props}
		/>
	);
}

export function DropdownMenuGroup(
	props: React.ComponentProps<typeof DropdownMenuGroupPrimitive>,
) {
	return <DropdownMenuGroupPrimitive {...props} />;
}

export function DropdownMenuLabel(
	props: React.ComponentProps<typeof DropdownMenuLabelPrimitive>,
) {
	return <DropdownMenuLabelPrimitive {...props} />;
}

export function DropdownMenuItem({
	variant = "default",
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuItemPrimitive>) {
	return (
		<DropdownMenuItemPrimitive
			{...props}
			variant={variant}
			className={cn(
				variant === "destructive" &&
					"text-destructive! focus:bg-destructive/10! focus:text-destructive! data-highlighted:bg-destructive/10! data-highlighted:text-destructive! dark:data-highlighted:bg-destructive/20 dark:focus:bg-destructive/20 *:[svg]:text-destructive! data-highlighted:*:[svg]:text-destructive!",
				className,
			)}
		/>
	);
}

export function DropdownMenuSub(
	props: React.ComponentProps<typeof DropdownMenuSubPrimitive>,
) {
	return <DropdownMenuSubPrimitive {...props} />;
}

export function DropdownMenuSubTrigger(
	props: React.ComponentProps<typeof DropdownMenuSubTriggerPrimitive>,
) {
	return <DropdownMenuSubTriggerPrimitive {...props} />;
}

export function DropdownMenuSubContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuSubContentPrimitive>) {
	return (
		<DropdownMenuSubContentPrimitive
			className={cn(destructivePopupOverrides, className)}
			{...props}
		/>
	);
}

export function DropdownMenuCheckboxItem(
	props: React.ComponentProps<typeof DropdownMenuCheckboxItemPrimitive>,
) {
	return <DropdownMenuCheckboxItemPrimitive {...props} />;
}

export function DropdownMenuRadioGroup(
	props: React.ComponentProps<typeof DropdownMenuRadioGroupPrimitive>,
) {
	return <DropdownMenuRadioGroupPrimitive {...props} />;
}

export function DropdownMenuRadioItem(
	props: React.ComponentProps<typeof DropdownMenuRadioItemPrimitive>,
) {
	return <DropdownMenuRadioItemPrimitive {...props} />;
}

export function DropdownMenuSeparator(
	props: React.ComponentProps<typeof DropdownMenuSeparatorPrimitive>,
) {
	return <DropdownMenuSeparatorPrimitive {...props} />;
}

export function DropdownMenuShortcut(
	props: React.ComponentProps<typeof DropdownMenuShortcutPrimitive>,
) {
	return <DropdownMenuShortcutPrimitive {...props} />;
}
