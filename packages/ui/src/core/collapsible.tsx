"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "~/lib/utils";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
	return (
		<CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
	);
}

function CollapsibleField({
	className,
	...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
	return (
		<CollapsibleTrigger
			className={cn(
				"flex h-10 w-full items-center gap-2 px-3 py-2 text-sm",
				className,
			)}
			{...props}
			type="button"
		/>
	);
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
	return (
		<CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
	);
}

export {
	Collapsible,
	CollapsibleContent,
	CollapsibleField,
	CollapsibleTrigger,
};
