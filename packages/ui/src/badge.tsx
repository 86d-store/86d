import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { Badge as BadgePrimitive } from "./shadcn/badge";

export const badgeVariants = cva("", {
	variants: {
		variant: {
			default: "",
			secondary: "",
			destructive:
				"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
			outline: "",
			ghost: "",
			link: "",
			caution:
				"bg-caution/10 text-caution focus-visible:ring-caution/20 dark:bg-caution/20 dark:focus-visible:ring-caution/40 [a]:hover:bg-caution/20",
			constructive:
				"bg-constructive/10 text-constructive focus-visible:ring-constructive/20 dark:bg-constructive/20 dark:focus-visible:ring-constructive/40 [a]:hover:bg-constructive/20",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function isProductBadgeVariant(
	variant: VariantProps<typeof badgeVariants>["variant"],
): variant is "caution" | "constructive" {
	return variant === "caution" || variant === "constructive";
}

export function Badge({
	className,
	variant = "default",
	...props
}: Omit<React.ComponentProps<typeof BadgePrimitive>, "variant"> &
	VariantProps<typeof badgeVariants>) {
	return (
		<BadgePrimitive
			variant={isProductBadgeVariant(variant) ? "default" : variant}
			className={cn(badgeVariants({ variant, className }))}
			{...props}
		/>
	);
}
