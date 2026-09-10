import { Button } from "@86d-app/ui/button";
import { buttonVariants } from "@86d-app/ui/shadcn/button";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

const actionClassName =
	"min-h-11 gap-2 transition-[background-color,color,box-shadow,opacity,scale] duration-150 ease-out active:translate-y-0 motion-reduce:transition-none sm:min-h-10";

export interface StoreActionProps extends ComponentProps<typeof Button> {
	static?: boolean;
}

export function StoreAction({
	className,
	static: isStatic = false,
	size = "default",
	...props
}: StoreActionProps) {
	return (
		<Button
			size={size}
			className={cn(
				actionClassName,
				size?.startsWith("icon") && "min-w-11 sm:min-w-10",
				!isStatic && "motion-safe:active:not-disabled:scale-[0.96]",
				className,
			)}
			{...props}
		/>
	);
}

export interface StoreLinkProps extends ComponentProps<typeof Link> {
	variant?: ComponentProps<typeof Button>["variant"];
	size?: ComponentProps<typeof Button>["size"];
}

export function StoreLink({
	className,
	variant = "outline",
	size = "default",
	...props
}: StoreLinkProps) {
	return (
		<Link
			className={cn(
				buttonVariants({ variant, size }),
				actionClassName,
				size?.startsWith("icon") && "min-w-11 sm:min-w-10",
				className,
			)}
			{...props}
		/>
	);
}
