import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "./lib/utils";

export type ViewProps = React.ComponentProps<"div"> & {
	asChild?: boolean;
};

/**
 * View component - a drop-in replacement for div.
 * Designed for future React Native compatibility.
 */
export function View({ className, asChild, ...props }: ViewProps) {
	const Comp = asChild ? Slot : "div";

	return <Comp data-slot="view" className={cn(className)} {...props} />;
}
