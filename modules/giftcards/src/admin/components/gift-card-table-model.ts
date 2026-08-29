import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
} from "@tanstack/react-table";
import {
	type GiftCardAdminSortField,
	isGiftCardAdminSortField,
} from "./gift-card-admin-types";

export interface GiftCardServerSort {
	sort: GiftCardAdminSortField;
	direction: "asc" | "desc";
}

export function getGiftCardServerSort(
	sorting: SortingState,
): GiftCardServerSort {
	const requested = sorting[0];
	if (!requested || !isGiftCardAdminSortField(requested.id)) {
		return { sort: "createdAt", direction: "desc" };
	}
	return {
		sort: requested.id,
		direction: requested.desc ? "desc" : "asc",
	};
}

export const giftCardTableFeatures = tableFeatures({
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
