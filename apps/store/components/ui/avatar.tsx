"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type * as React from "react";

import { cn } from "~/lib/utils";

function Avatar({
	className,
	size = "default",
	shape = "circle",
	...props
}: AvatarPrimitive.Root.Props & {
	size?: "default" | "sm" | "lg";
	/** `circle` for people; `rounded` for businesses and stores. */
	shape?: "circle" | "rounded";
}) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			data-size={size}
			data-shape={shape}
			className={cn(
				"group/avatar relative flex size-8 shrink-0 select-none after:absolute after:inset-0 after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
				"data-[shape=circle]:rounded-full data-[shape=circle]:after:rounded-full",
				"data-[shape=rounded]:rounded-lg data-[shape=rounded]:after:rounded-lg",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			className={cn(
				"aspect-square size-full object-cover group-data-[shape=circle]/avatar:rounded-full group-data-[shape=rounded]/avatar:rounded-lg",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	...props
}: AvatarPrimitive.Fallback.Props) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center bg-muted text-muted-foreground text-sm group-data-[shape=circle]/avatar:rounded-full group-data-[shape=rounded]/avatar:rounded-lg group-data-[size=sm]/avatar:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="avatar-badge"
			className={cn(
				"absolute right-0 bottom-0 z-10 inline-flex select-none items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group"
			className={cn(
				"group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroupCount({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group-count"
			className={cn(
				"relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
};
