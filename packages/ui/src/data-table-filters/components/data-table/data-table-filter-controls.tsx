"use client";

import { useEffect, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "~/data-table-filters/components/custom/accordion";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import { DataTableFilterCheckbox } from "~/data-table-filters/components/data-table/data-table-filter-checkbox";
import { DataTableFilterInput } from "~/data-table-filters/components/data-table/data-table-filter-input";
import { DataTableFilterResetButton } from "~/data-table-filters/components/data-table/data-table-filter-reset-button";
import { DataTableFilterSlider } from "~/data-table-filters/components/data-table/data-table-filter-slider";
import { DataTableFilterTimerange } from "~/data-table-filters/components/data-table/data-table-filter-timerange";

// FIXME: use @container (especially for the slider element) to restructure elements

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/latest/docs/framework/react/examples/filters

// Pluggable filter registry — extend by adding entries
// biome-ignore lint/suspicious/noExplicitAny: registry values are heterogeneous filter field components
export const FILTER_COMPONENTS: Record<string, React.ComponentType<any>> = {
	checkbox: DataTableFilterCheckbox,
	input: DataTableFilterInput,
	slider: DataTableFilterSlider,
	timerange: DataTableFilterTimerange,
};

export function DataTableFilterControls() {
	const { filterFields } = useDataTable();
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setIsMounted(true), 0);
		return () => clearTimeout(timer);
	}, []);

	return (
		<Accordion
			multiple
			className={
				isMounted
					? undefined
					: "[&_[data-slot=accordion-content]]:!animate-none"
			}
			defaultValue={filterFields
				.filter(({ defaultOpen }) => defaultOpen)
				.map(({ value }) => value as string)}
		>
			{filterFields.map((field) => {
				const value = field.value as string;
				const FilterComponent = FILTER_COMPONENTS[field.type];
				if (!FilterComponent) return null;
				return (
					// REMINDER: -mx-2 lets the border-b span the full sidebar width despite the parent p-2; px-2 keeps the content aligned
					<AccordionItem key={value} value={value} className="-mx-2 px-2">
						<AccordionTrigger className="w-full items-center gap-2 px-2 py-0 hover:no-underline data-closed:text-muted-foreground data-open:text-foreground hover:data-closed:text-foreground focus-within:data-closed:text-foreground">
							<div className="flex w-full items-center justify-between gap-2 truncate py-3 pr-2">
								<div className="flex items-center gap-2 truncate">
									<p className="font-medium text-sm">{field.label}</p>
									{value !== field.label.toLowerCase() &&
									!field.commandDisabled ? (
										<p className="mt-px truncate font-mono text-[10px] text-muted-foreground">
											{value}
										</p>
									) : null}
								</div>
								<DataTableFilterResetButton {...field} />
							</div>
						</AccordionTrigger>
						<AccordionContent>
							{/* REMINDER: avoid the focus state to be cut due to overflow-hidden */}
							{/* REMINDER: need to move within here because of accordion height animation */}
							<div className="p-1">
								<FilterComponent {...field} />
							</div>
						</AccordionContent>
					</AccordionItem>
				);
			})}
		</Accordion>
	);
}
