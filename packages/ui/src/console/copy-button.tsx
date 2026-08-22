"use client";

import {
	CheckIcon,
	CopySimpleIcon,
	XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { VariantProps } from "class-variance-authority";
import { useCallback, useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { Button, type buttonVariants } from "~/shadcn/button";

export interface CopyButtonProps
	extends Omit<React.ComponentProps<typeof Button>, "onClick">,
		VariantProps<typeof buttonVariants> {
	value: string;
}

export function CopyButton({
	value,
	children,
	className,
	variant = "ghost",
	size = "icon",
	...props
}: CopyButtonProps) {
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
	const handleClick = useCallback(
		async (e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();

			try {
				await navigator.clipboard.writeText(value);
				setStatus("success");
			} catch {
				setStatus("error");
			}
		},
		[value],
	);

	useEffect(() => {
		if (status === "idle") return;
		const timeout = setTimeout(() => setStatus("idle"), 2000);
		return () => clearTimeout(timeout);
	}, [status]);

	return (
		<Button
			data-slot="copy-button"
			data-state={status}
			aria-label="Copy to clipboard"
			variant={variant}
			size={size}
			className={cn(
				"data-[state=error]:text-destructive data-[state=success]:text-emerald-500",
				className,
			)}
			onClick={handleClick}
			{...props}
		>
			{children ?? (
				<>
					<CopySimpleIcon
						weight="bold"
						className="in-data-[state=error]:hidden in-data-[state=success]:hidden data-[state=error]:hidden data-[state=success]:hidden"
					/>
					<CheckIcon
						weight="bold"
						className="in-data-[state=success]:block hidden"
					/>
					<XIcon weight="bold" className="in-data-[state=error]:block hidden" />
				</>
			)}
		</Button>
	);
}
