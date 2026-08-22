"use client";

import type * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupValue } from "~/input-group";
import { cn } from "~/lib/utils";
import { Text } from "~/text";
import { View } from "~/view";
import { CopyButton } from "./copy-button";

export interface CopyTextProps
	extends Omit<React.ComponentProps<typeof InputGroup>, "variant"> {
	variants?: "default" | "inline";
	value?: string | null;
	copyable?: boolean;
	textClassName?: string;
}

export function CopyText({
	value,
	children,
	variants = "default",
	copyable = true,
	textClassName,
	className,
	...props
}: CopyTextProps) {
	const copyValue = value || children?.toString() || "";
	const label = children ?? value;

	if (variants === "inline") {
		return (
			<View
				data-slot="copy-text"
				className={cn("inline-flex max-w-full items-center gap-1", className)}
				{...props}
			>
				<Text className={cn("min-w-0 truncate", textClassName)}>{label}</Text>
				{copyable ? (
					<CopyButton
						value={copyValue}
						className="size-auto shrink-0 p-1 text-muted-foreground"
						size="icon-sm"
					/>
				) : null}
			</View>
		);
	}

	return (
		<InputGroup
			data-slot="copy-text"
			variant="muted"
			className={cn("max-w-xs", className)}
			{...props}
		>
			<InputGroupValue className={textClassName}>{label}</InputGroupValue>
			{copyable ? (
				<InputGroupAddon align="inline-end">
					<CopyButton
						value={copyValue}
						size="icon-sm"
						variant="ghost"
						className="size-auto p-1 text-muted-foreground"
					/>
				</InputGroupAddon>
			) : null}
		</InputGroup>
	);
}
