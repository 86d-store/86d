"use client";

import FilterChipTemplate from "./filter-chip.mdx";

export interface FilterChipProps {
	label: string;
	onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
	return <FilterChipTemplate label={label} onRemove={onRemove} />;
}
