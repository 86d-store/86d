import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import {
	AlertAction as AlertActionPrimitive,
	AlertDescription as AlertDescriptionPrimitive,
	Alert as AlertPrimitive,
	AlertTitle as AlertTitlePrimitive,
} from "./shadcn/alert";

export const alertVariants = cva("", {
	variants: {
		variant: {
			default: "",
			destructive:
				"border-destructive/30 bg-destructive/5 text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",

			caution:
				"border-caution/30 bg-caution/5 text-caution *:data-[slot=alert-description]:text-caution/90 *:[svg]:text-current",
			constructive:
				"border-constructive/30 bg-constructive/5 text-constructive *:data-[slot=alert-description]:text-constructive/90 *:[svg]:text-current",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function isProductAlertVariant(
	variant: VariantProps<typeof alertVariants>["variant"],
): variant is "caution" | "constructive" {
	return variant === "caution" || variant === "constructive";
}

export function Alert({
	className,
	variant = "default",
	...props
}: Omit<React.ComponentProps<typeof AlertPrimitive>, "variant"> &
	VariantProps<typeof alertVariants>) {
	return (
		<AlertPrimitive
			variant={isProductAlertVariant(variant) ? "default" : variant}
			className={cn(alertVariants({ variant, className }))}
			{...props}
		/>
	);
}

export function AlertTitle(
	props: React.ComponentProps<typeof AlertTitlePrimitive>,
) {
	return <AlertTitlePrimitive {...props} />;
}

export function AlertDescription(
	props: React.ComponentProps<typeof AlertDescriptionPrimitive>,
) {
	return <AlertDescriptionPrimitive {...props} />;
}

export function AlertAction(
	props: React.ComponentProps<typeof AlertActionPrimitive>,
) {
	return <AlertActionPrimitive {...props} />;
}
