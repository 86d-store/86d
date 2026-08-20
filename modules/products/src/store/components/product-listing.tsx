"use client";

import { useState } from "react";
import { useProductsApi } from "./_hooks";
import type { Category, Product } from "./_types";
import { FilterChip } from "./filter-chip";
import { ProductCard } from "./product-card";
import ProductListingTemplate from "./product-listing.mdx";

export interface ProductListingProps {
	initialCategory?: string;
	initialSearch?: string;
	pageSize?: number;
}

export function ProductListing({
	initialCategory = "",
	initialSearch = "",
	pageSize = 12,
}: ProductListingProps) {
	const api = useProductsApi();

	const [page, setPage] = useState(1);
	const [category, setCategory] = useState(initialCategory);
	const [search, setSearch] = useState(initialSearch);
	const [sort, setSort] = useState<"name" | "price" | "createdAt">("createdAt");
	const [order, setOrder] = useState<"asc" | "desc">("desc");
	const [minPrice, setMinPrice] = useState("");
	const [maxPrice, setMaxPrice] = useState("");
	const [inStock, setInStock] = useState(false);
	const [tag, setTag] = useState("");
	const [showFilters, setShowFilters] = useState(false);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
		sort,
		order,
	};
	if (category) queryInput.category = category;
	if (search) queryInput.search = search;
	if (minPrice) queryInput.minPrice = String(parseInt(minPrice, 10) * 100);
	if (maxPrice) queryInput.maxPrice = String(parseInt(maxPrice, 10) * 100);
	if (inStock) queryInput.inStock = "true";
	if (tag) queryInput.tag = tag;

	const {
		data: productsData,
		isLoading,
		isError,
	} = api.listProducts.useQuery(queryInput) as {
		data: { products: Product[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const { data: categoriesData } = api.listCategories.useQuery() as {
		data: { categories: Category[] } | undefined;
	};

	const products = productsData?.products ?? [];
	const total = productsData?.total ?? 0;
	const categories = categoriesData?.categories ?? [];
	const totalPages = Math.ceil(total / pageSize);

	const hasActiveFilters =
		!!search || !!category || !!minPrice || !!maxPrice || inStock || !!tag;

	const clearAllFilters = () => {
		setSearch("");
		setCategory("");
		setMinPrice("");
		setMaxPrice("");
		setInStock(false);
		setTag("");
		setPage(1);
	};

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setPage(1);
	};

	const filtersBar = (
		<div className="mb-4 flex flex-wrap items-center gap-2.5">
			<form
				onSubmit={handleSearch}
				className="flex min-w-[180px] flex-1 items-center"
			>
				<div className="relative flex-1">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						type="search"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						placeholder="Search…"
						aria-label="Search products"
						className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-foreground text-sm placeholder:text-muted-foreground/60 focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
					/>
				</div>
			</form>

			{categories.length > 0 && (
				<select
					aria-label="Filter by category"
					value={category}
					onChange={(e) => {
						setCategory(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-2.5 text-foreground text-sm focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
				>
					<option value="">All categories</option>
					{categories.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			)}

			<select
				aria-label="Sort products"
				value={`${sort}:${order}`}
				onChange={(e) => {
					const [s, o] = e.target.value.split(":");
					setSort(s as "name" | "price" | "createdAt");
					setOrder(o as "asc" | "desc");
					setPage(1);
				}}
				className="h-9 rounded-md border border-border bg-background px-2.5 text-foreground text-sm focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
			>
				<option value="createdAt:desc">Newest</option>
				<option value="createdAt:asc">Oldest</option>
				<option value="price:asc">Price: Low → High</option>
				<option value="price:desc">Price: High → Low</option>
				<option value="name:asc">A → Z</option>
				<option value="name:desc">Z → A</option>
			</select>

			<button
				type="button"
				onClick={() => setShowFilters((v) => !v)}
				className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
					showFilters || hasActiveFilters
						? "border-foreground/30 bg-foreground/5 text-foreground"
						: "border-border text-muted-foreground hover:text-foreground"
				}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
				</svg>
				Filters
				{hasActiveFilters && (
					<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-2xs text-background">
						{
							[search, category, minPrice, maxPrice, inStock, tag].filter(
								Boolean,
							).length
						}
					</span>
				)}
			</button>

			{total > 0 && (
				<span className="text-muted-foreground text-xs tabular-nums">
					{total} {total === 1 ? "product" : "products"}
				</span>
			)}
		</div>
	);

	const filterPanel = showFilters ? (
		<div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
			<div className="flex flex-wrap items-end gap-4">
				<div className="flex items-end gap-2">
					<div>
						<label
							htmlFor="minPrice"
							className="mb-1 block text-muted-foreground text-xs"
						>
							Min price
						</label>
						<div className="relative">
							<span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-xs">
								$
							</span>
							<input
								id="minPrice"
								type="number"
								min="0"
								value={minPrice}
								onChange={(e) => {
									setMinPrice(e.target.value);
									setPage(1);
								}}
								placeholder="0"
								className="h-8 w-20 rounded-md border border-border bg-background pr-2 pl-6 text-foreground text-sm tabular-nums focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
							/>
						</div>
					</div>
					<span className="pb-1.5 text-muted-foreground text-xs">–</span>
					<div>
						<label
							htmlFor="maxPrice"
							className="mb-1 block text-muted-foreground text-xs"
						>
							Max price
						</label>
						<div className="relative">
							<span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-xs">
								$
							</span>
							<input
								id="maxPrice"
								type="number"
								min="0"
								value={maxPrice}
								onChange={(e) => {
									setMaxPrice(e.target.value);
									setPage(1);
								}}
								placeholder="Any"
								className="h-8 w-20 rounded-md border border-border bg-background pr-2 pl-6 text-foreground text-sm tabular-nums focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
							/>
						</div>
					</div>
				</div>

				<label
					htmlFor="inStockToggle"
					className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5"
				>
					<input
						id="inStockToggle"
						type="checkbox"
						checked={inStock}
						onChange={(e) => {
							setInStock(e.target.checked);
							setPage(1);
						}}
						className="accent-foreground"
					/>
					<span className="text-foreground text-sm">In stock only</span>
				</label>

				<div>
					<label
						htmlFor="tagFilter"
						className="mb-1 block text-muted-foreground text-xs"
					>
						Tag
					</label>
					<input
						id="tagFilter"
						type="text"
						value={tag}
						onChange={(e) => {
							setTag(e.target.value);
							setPage(1);
						}}
						placeholder="e.g. sale"
						className="h-8 w-28 rounded-md border border-border bg-background px-2.5 text-foreground text-sm placeholder:text-muted-foreground/50 focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/10"
					/>
				</div>

				{hasActiveFilters && (
					<button
						type="button"
						onClick={clearAllFilters}
						className="h-8 rounded-md border border-border px-2.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
					>
						Clear all
					</button>
				)}
			</div>
		</div>
	) : null;

	const filterChips =
		hasActiveFilters && !showFilters ? (
			<div className="mb-4 flex flex-wrap items-center gap-1.5">
				{category && (
					<FilterChip
						label={`Category: ${categories.find((c) => c.id === category)?.name ?? category}`}
						onRemove={() => {
							setCategory("");
							setPage(1);
						}}
					/>
				)}
				{(minPrice || maxPrice) && (
					<FilterChip
						label={`Price: ${minPrice ? `$${minPrice}` : "$0"} – ${maxPrice ? `$${maxPrice}` : "any"}`}
						onRemove={() => {
							setMinPrice("");
							setMaxPrice("");
							setPage(1);
						}}
					/>
				)}
				{inStock && (
					<FilterChip
						label="In stock"
						onRemove={() => {
							setInStock(false);
							setPage(1);
						}}
					/>
				)}
				{tag && (
					<FilterChip
						label={`Tag: ${tag}`}
						onRemove={() => {
							setTag("");
							setPage(1);
						}}
					/>
				)}
				<button
					type="button"
					onClick={clearAllFilters}
					className="text-muted-foreground text-xs transition-colors hover:text-foreground"
				>
					Clear all
				</button>
			</div>
		) : null;

	const gridContent = isError ? (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<p className="font-medium text-foreground text-sm">
				Something went wrong
			</p>
			<p className="mt-1 text-muted-foreground text-sm">
				We couldn&apos;t load products right now. Please try again.
			</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-4 rounded-full border border-border px-4 py-1.5 text-foreground text-xs transition-colors hover:bg-muted"
			>
				Refresh page
			</button>
		</div>
	) : isLoading ? (
		<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
			{Array.from({ length: pageSize }, (_, i) => `listing-skel-${i}`).map(
				(id) => (
					<div key={id}>
						<div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
						<div className="mt-3 space-y-1.5">
							<div className="h-3.5 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
							<div className="h-3.5 w-1/3 animate-pulse rounded bg-muted-foreground/10" />
						</div>
					</div>
				),
			)}
		</div>
	) : products.length === 0 ? (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<p className="font-medium text-foreground text-sm">No products found</p>
			<p className="mt-1 text-muted-foreground text-sm">
				Try adjusting your search or filters
			</p>
			{hasActiveFilters && (
				<button
					type="button"
					onClick={clearAllFilters}
					className="mt-4 rounded-full border border-border px-4 py-1.5 text-foreground text-xs transition-colors hover:bg-muted"
				>
					Clear filters
				</button>
			)}
		</div>
	) : (
		<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
			{products.map((product) => (
				<ProductCard key={product.id} product={product} />
			))}
		</div>
	);

	const pagination =
		totalPages > 1 ? (
			<div className="mt-12 flex items-center justify-center gap-2">
				<button
					type="button"
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page === 1}
					className="h-8 rounded-md border border-border px-3 text-foreground text-xs transition-colors hover:bg-muted disabled:opacity-30"
				>
					Previous
				</button>
				<span className="min-w-15 text-center text-muted-foreground text-xs tabular-nums">
					{page} / {totalPages}
				</span>
				<button
					type="button"
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page === totalPages}
					className="h-8 rounded-md border border-border px-3 text-foreground text-xs transition-colors hover:bg-muted disabled:opacity-30"
				>
					Next
				</button>
			</div>
		) : null;

	return (
		<ProductListingTemplate
			filtersBar={filtersBar}
			filterPanel={filterPanel}
			filterChips={filterChips}
			gridContent={gridContent}
			pagination={pagination}
		/>
	);
}
