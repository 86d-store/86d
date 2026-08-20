import { makeAutoObservable } from "@86d-app/core/state";

export type SortField = "name" | "price" | "createdAt";
export type SortOrder = "asc" | "desc";
export type ViewMode = "grid" | "list";

/**
 * Products UI state — shared across components via MobX.
 * Persists active filters, sort order, and view mode across navigations.
 */
export const productsState = makeAutoObservable({
	/** Active category filter (empty = all categories) */
	activeCategory: "",
	/** Search query */
	searchQuery: "",
	/** Sort field */
	sortField: "createdAt" as SortField,
	/** Sort direction */
	sortOrder: "desc" as SortOrder,
	/** Grid vs list view */
	viewMode: "grid" as ViewMode,
	/** Price range filter (in display dollars, not cents) */
	minPrice: "",
	maxPrice: "",
	/** Stock filter */
	inStockOnly: false,
	/** Tag filter */
	activeTag: "",

	setCategory(category: string) {
		this.activeCategory = category;
	},

	setSearchQuery(query: string) {
		this.searchQuery = query;
	},

	setSortField(field: SortField) {
		this.sortField = field;
	},

	setSortOrder(order: SortOrder) {
		this.sortOrder = order;
	},

	setViewMode(mode: ViewMode) {
		this.viewMode = mode;
	},

	setPriceRange(min: string, max: string) {
		this.minPrice = min;
		this.maxPrice = max;
	},

	setInStockOnly(v: boolean) {
		this.inStockOnly = v;
	},

	setActiveTag(tag: string) {
		this.activeTag = tag;
	},

	clearFilters() {
		this.activeCategory = "";
		this.searchQuery = "";
		this.minPrice = "";
		this.maxPrice = "";
		this.inStockOnly = false;
		this.activeTag = "";
	},

	get hasActiveFilters(): boolean {
		return (
			!!this.searchQuery ||
			!!this.activeCategory ||
			!!this.minPrice ||
			!!this.maxPrice ||
			this.inStockOnly ||
			!!this.activeTag
		);
	},
});

export type ProductsState = typeof productsState;
