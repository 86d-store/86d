import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "~/lib/utils";

const textVariants = cva("", {
	variants: {
		variant: {
			span: "",
			p: "",
			label: "",
			h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
			h2: "scroll-m-20 text-3xl font-semibold tracking-tight",
			h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
			h4: "scroll-m-20 text-xl font-semibold tracking-tight",
			h5: "scroll-m-20 text-lg font-semibold tracking-tight",
			h6: "scroll-m-20 text-base font-semibold tracking-tight",
		},
	},
	defaultVariants: {
		variant: "span",
	},
});

export type TextProps = React.ComponentProps<
	"span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "label"
> &
	VariantProps<typeof textVariants> & {
		asChild?: boolean;
	};

/**
 * Text component - a drop-in replacement for span.
 * Designed for future React Native compatibility.
 */
export function Text({
	className,
	asChild,
	variant = "span",
	...props
}: TextProps) {
	const element = variant ?? "span";
	const Comp = asChild ? Slot : (element as React.ElementType);

	return (
		<Comp
			data-slot="text"
			className={cn(textVariants({ variant, className }))}
			{...props}
		/>
	);
}

export { textVariants };
