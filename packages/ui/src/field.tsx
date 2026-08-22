import { cn } from "~/lib/utils";

export function FieldHint({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="field-hint"
			className={cn(
				"ml-auto font-normal text-muted-foreground text-xs",
				className,
			)}
			{...props}
		/>
	);
}
