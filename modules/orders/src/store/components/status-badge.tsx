"use client";

import StatusBadgeTemplate from "./status-badge.mdx";

export function StatusBadge({
	value,
	styles,
}: {
	value: string;
	styles: Record<string, string>;
}) {
	const colorClass = styles[value] ?? "bg-muted/30 text-foreground";
	const label = value.replace(/_/g, " ");

	return <StatusBadgeTemplate colorClass={colorClass} label={label} />;
}
