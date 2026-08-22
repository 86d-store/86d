import { Command as CommandPrimitive } from "cmdk";
import { cn } from "~/lib/utils";

export function CommandLoading({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>) {
	return (
		<CommandPrimitive.Loading
			data-slot="command-loading"
			className={cn("py-6 text-center text-sm", className)}
			{...props}
		/>
	);
}
