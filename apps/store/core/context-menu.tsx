"use client";

import type React from "react";

interface ContextMenuProps {
	children: React.ReactNode;
}

export function ContextMenu({ children }: ContextMenuProps) {
	return <>{children}</>;
}

interface ContextMenuTriggerProps {
	children: React.ReactNode;
}

export function ContextMenuTrigger({ children }: ContextMenuTriggerProps) {
	return <>{children}</>;
}

interface ContextMenuContentProps {
	children: React.ReactNode;
	className?: string;
}

export function ContextMenuContent({
	children,
	className,
}: ContextMenuContentProps) {
	return (
		<div className={className} role="menu">
			{children}
		</div>
	);
}

interface ContextMenuItemProps {
	children: React.ReactNode;
	onClick?: () => void;
}

export function ContextMenuItem({ children, onClick }: ContextMenuItemProps) {
	return (
		<button type="button" role="menuitem" onClick={onClick}>
			{children}
		</button>
	);
}
