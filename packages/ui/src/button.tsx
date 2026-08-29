import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { Button as ButtonPrimitive } from "./shadcn/button";

export const buttonVariants = cva("", {
	variants: {
		variant: {
			default: "",
			outline: "",
			secondary: "",
			ghost: "",
			destructive:
				"bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
			caution:
				"bg-caution/10 text-caution hover:bg-caution/20 focus-visible:border-caution/40 focus-visible:ring-caution/20 dark:bg-caution/20 dark:hover:bg-caution/30 dark:focus-visible:ring-caution/40",
			constructive:
				"bg-constructive/10 text-constructive hover:bg-constructive/20 focus-visible:border-constructive/40 focus-visible:ring-constructive/20 dark:bg-constructive/20 dark:hover:bg-constructive/30 dark:focus-visible:ring-constructive/40",
			link: "font-mono text-primary-950 underline decoration-neutral-200 underline-offset-8 transition-all hover:text-primary-800 hover:decoration-primary-200 hover:underline-offset-6 group-hover/button:underline-offset-6 group-hover/button:text-primary-800 focus:text-primary-800 focus:decoration-primary-200 group-focus/button:decoration-primary-200 group-hover/button:decoration-primary-200", // "text-primary underline-offset-4 hover:underline",
		},
		size: {
			default: "h-10 px-3! gap-x-1.5!",
			xs: "",
			sm: "",
			lg: "",
			icon: "",
			"icon-xs": "",
			"icon-sm": "",
			"icon-lg": "",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

export function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: React.ComponentProps<typeof ButtonPrimitive> &
	VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			variant={variant}
			size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}
