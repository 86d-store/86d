import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
} from "@tanstack/react-table";

export const KIOSK_TABLE_PAGE_SIZE = 20;

export const kioskTableFeatures = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	columnVisibilityFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: {
		includesString: filterFn_includesString,
	},
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
	},
});
