"use client";

import { CopySimpleIcon, LinkIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ContextMenuItem } from "~/context-menu";

export interface CopyMenuItemProps
	extends React.ComponentProps<typeof ContextMenuItem> {
	value: string;
	label: string;
	icon?: ReactNode;
}

export function CopyMenuItem({
	value,
	label,
	icon,
	...props
}: CopyMenuItemProps) {
	const handleClick = () => {
		navigator.clipboard.writeText(value).then(() => {
			toast.success(`${label} copied to clipboard`);
		});
	};

	return (
		<ContextMenuItem onClick={handleClick} {...props}>
			{icon ?? <CopySimpleIcon weight="bold" />}
			Copy {label}
		</ContextMenuItem>
	);
}

export interface CopyUrlMenuItemProps
	extends React.ComponentProps<typeof ContextMenuItem> {
	path: string;
	label: string;
}

export function CopyUrlMenuItem({
	path,
	label,
	...props
}: CopyUrlMenuItemProps) {
	const urlLabel = `${label} URL`;
	const handleClick = async () => {
		try {
			const absolute = new URL(path, window.location.origin).href;
			await navigator.clipboard.writeText(absolute);
			toast.success(`${urlLabel} copied to clipboard`);
		} catch {
			toast.error(`Failed to copy ${urlLabel}`);
		}
	};

	return (
		<ContextMenuItem onClick={handleClick} {...props}>
			<LinkIcon weight="bold" />
			Copy {urlLabel}
		</ContextMenuItem>
	);
}
