import { SpinnerBallIcon } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";

function Spinner({
	className,
	...props
}: React.ComponentProps<typeof SpinnerBallIcon>) {
	return (
		<SpinnerBallIcon
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
