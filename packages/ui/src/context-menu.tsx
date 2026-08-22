"use client";

import type * as React from "react";
import { cn } from "~/lib/utils";
import {
	ContextMenuCheckboxItem as ContextMenuCheckboxItemPrimitive,
	ContextMenuContent as ContextMenuContentPrimitive,
	ContextMenuGroup as ContextMenuGroupPrimitive,
	ContextMenuItem as ContextMenuItemPrimitive,
	ContextMenuLabel as ContextMenuLabelPrimitive,
	ContextMenuPortal as ContextMenuPortalPrimitive,
	ContextMenu as ContextMenuPrimitive,
	ContextMenuRadioGroup as ContextMenuRadioGroupPrimitive,
	ContextMenuRadioItem as ContextMenuRadioItemPrimitive,
	ContextMenuSeparator as ContextMenuSeparatorPrimitive,
	ContextMenuShortcut as ContextMenuShortcutPrimitive,
	ContextMenuSubContent as ContextMenuSubContentPrimitive,
	ContextMenuSub as ContextMenuSubPrimitive,
	ContextMenuSubTrigger as ContextMenuSubTriggerPrimitive,
	ContextMenuTrigger as ContextMenuTriggerPrimitive,
} from "./shadcn/context-menu";

export function ContextMenu(
	props: React.ComponentProps<typeof ContextMenuPrimitive>,
) {
	return <ContextMenuPrimitive {...props} />;
}

export function ContextMenuPortal(
	props: React.ComponentProps<typeof ContextMenuPortalPrimitive>,
) {
	return <ContextMenuPortalPrimitive {...props} />;
}

export function ContextMenuTrigger(
	props: React.ComponentProps<typeof ContextMenuTriggerPrimitive>,
) {
	return <ContextMenuTriggerPrimitive {...props} />;
}

const destructivePopupOverrides =
	"**:data-[variant=destructive]:text-destructive! **:data-[variant=destructive]:**:text-destructive! **:data-[variant=destructive]:*:[svg]:text-destructive! **:data-[variant=destructive]:data-highlighted:text-destructive! **:data-[variant=destructive]:data-highlighted:bg-destructive/10! **:data-[variant=destructive]:focus:text-destructive! **:data-[variant=destructive]:focus:bg-destructive/10!";

export function ContextMenuContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuContentPrimitive>) {
	return (
		<ContextMenuContentPrimitive
			className={cn(destructivePopupOverrides, className)}
			{...props}
		/>
	);
}

export function ContextMenuGroup(
	props: React.ComponentProps<typeof ContextMenuGroupPrimitive>,
) {
	return <ContextMenuGroupPrimitive {...props} />;
}

export function ContextMenuLabel(
	props: React.ComponentProps<typeof ContextMenuLabelPrimitive>,
) {
	return <ContextMenuLabelPrimitive {...props} />;
}

export function ContextMenuItem({
	variant = "default",
	className,
	...props
}: React.ComponentProps<typeof ContextMenuItemPrimitive>) {
	return (
		<ContextMenuItemPrimitive
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

export function ContextMenuSub(
	props: React.ComponentProps<typeof ContextMenuSubPrimitive>,
) {
	return <ContextMenuSubPrimitive {...props} />;
}

export function ContextMenuSubTrigger(
	props: React.ComponentProps<typeof ContextMenuSubTriggerPrimitive>,
) {
	return <ContextMenuSubTriggerPrimitive {...props} />;
}

export function ContextMenuSubContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuSubContentPrimitive>) {
	return (
		<ContextMenuSubContentPrimitive
			className={cn(destructivePopupOverrides, className)}
			{...props}
		/>
	);
}

export function ContextMenuCheckboxItem(
	props: React.ComponentProps<typeof ContextMenuCheckboxItemPrimitive>,
) {
	return <ContextMenuCheckboxItemPrimitive {...props} />;
}

export function ContextMenuRadioGroup(
	props: React.ComponentProps<typeof ContextMenuRadioGroupPrimitive>,
) {
	return <ContextMenuRadioGroupPrimitive {...props} />;
}

export function ContextMenuRadioItem(
	props: React.ComponentProps<typeof ContextMenuRadioItemPrimitive>,
) {
	return <ContextMenuRadioItemPrimitive {...props} />;
}

export function ContextMenuSeparator(
	props: React.ComponentProps<typeof ContextMenuSeparatorPrimitive>,
) {
	return <ContextMenuSeparatorPrimitive {...props} />;
}

export function ContextMenuShortcut(
	props: React.ComponentProps<typeof ContextMenuShortcutPrimitive>,
) {
	return <ContextMenuShortcutPrimitive {...props} />;
}
