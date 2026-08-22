import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import {
	CardAction as CardActionPrimitive,
	CardContent as CardContentPrimitive,
	CardDescription as CardDescriptionPrimitive,
	CardFooter as CardFooterPrimitive,
	CardHeader as CardHeaderPrimitive,
	Card as CardPrimitive,
	CardTitle as CardTitlePrimitive,
} from "./core/card";

export const cardVariants = cva("", {
	variants: {
		variant: {
			default: "",
			destructive:
				"bg-destructive/10 text-destructive ring-destructive/20 *:data-[slot=card-description]:text-destructive/75 dark:bg-destructive/20 dark:ring-destructive/40",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export function Card({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof CardPrimitive> &
	VariantProps<typeof cardVariants>) {
	return (
		<CardPrimitive
			data-variant={variant}
			className={cn(cardVariants({ variant, className }))}
			{...props}
		/>
	);
}

export function CardHeader(
	props: React.ComponentProps<typeof CardHeaderPrimitive>,
) {
	return <CardHeaderPrimitive {...props} />;
}

export function CardTitle(
	props: React.ComponentProps<typeof CardTitlePrimitive>,
) {
	return <CardTitlePrimitive {...props} />;
}

export function CardDescription(
	props: React.ComponentProps<typeof CardDescriptionPrimitive>,
) {
	return <CardDescriptionPrimitive {...props} />;
}

export function CardAction(
	props: React.ComponentProps<typeof CardActionPrimitive>,
) {
	return <CardActionPrimitive {...props} />;
}

export function CardContent(
	props: React.ComponentProps<typeof CardContentPrimitive>,
) {
	return <CardContentPrimitive {...props} />;
}

export function CardFooter(
	props: React.ComponentProps<typeof CardFooterPrimitive>,
) {
	return <CardFooterPrimitive {...props} />;
}
