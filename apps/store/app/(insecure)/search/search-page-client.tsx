"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useStoreContext } from "@86d-app/core/client/store-context";
import { SearchIcon as LucideSearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";
import type { RootStore } from "~/lib/store";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
	id: string;
	name: string;
	slug: string;
	price: number;
	compareAtPrice?: number | null;
	shortDescription?: string | null;
	description?: string | null;
	images: string[];
	isFeatured: boolean;
	status: string;
	inventory: number;
	categoryId?: string | null;
	tags: string[];
}

interface Category {
	id: string;
	name: string;
	slug: string;
}

interface ListResult {
	products: Product[];
	total: number;
	page: number;
	limit: number;
}

interface RawCartItem {
	id: string;
	productId: string;
	variantId?: string | null;
	quantity: number;
	price: number;
	productName: string;
	productSlug: string;
	productImage?: string | null;
	variantName?: string | null;
	variantOptions?: Record<string, string> | null;
}

function normalizeCartQueryData(data: {
	cart: { id: string };
	items: RawCartItem[];
	itemCount: number;
	subtotal: number;
}) {
	return {
		id: data.cart.id,
		items: data.items.map((item) => ({
			id: item.id,
			productId: item.productId,
			variantId: item.variantId ?? null,
			quantity: item.quantity,
			price: item.price,
			product: {
				name: item.productName,
				price: item.price,
				images: item.productImage ? [item.productImage] : [],
				slug: item.productSlug,
			},
			variant: item.variantName
				? {
						name: item.variantName,
						options: item.variantOptions ?? {},
					}
				: null,
		})),
		itemCount: data.itemCount,
		subtotal: data.subtotal,
	};
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function useProductsApi() {
	const client = useModuleClient();
	return {
		listProducts: client.module("products").store["/products"],
		listCategories: client.module("products").store["/categories"],
	};
}

function useCartMutation() {
	const client = useModuleClient();
	return {
		addToCart: client.module("cart").store["/cart"],
		getCart: client.module("cart").store["/cart/get"],
		queryClient: client.queryClient,
	};
}

function useTrack() {
	const client = useModuleClient();
	const tracker = client.module("analytics").store["/analytics/events"];
	const ref = useRef(tracker);
	ref.current = tracker;

	return useCallback(
		(params: {
			type: string;
			productId?: string;
			value?: number;
			data?: Record<string, unknown>;
		}) => {
			try {
				void ref.current.mutate(params);
			} catch {
				// Analytics is best-effort
			}
		},
		[],
	);
}

// ─── SearchIcon ─────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

// ─── ProductCard ────────────────────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
	product,
}: {
	product: Product;
}) {
	const cartApi = useCartMutation();
	const track = useTrack();
	const store = useStoreContext<RootStore>();

	const addToCartMutation = cartApi.addToCart.useMutation({
		onSuccess: (data: {
			cart: { id: string };
			items: RawCartItem[];
			itemCount: number;
			subtotal: number;
		}) => {
			store.cart.setItemCount(data.itemCount);
			store.cart.openDrawer();
			cartApi.queryClient.setQueryData(
				cartApi.getCart.getQueryKey(),
				normalizeCartQueryData(data),
			);
			track({
				type: "addToCart",
				productId: product.id,
				value: product.price,
				data: { name: product.name, quantity: 1 },
			});
		},
	});

	const image = product.images[0];
	const hasDiscount =
		product.compareAtPrice != null && product.compareAtPrice > product.price;
	const discountPct = hasDiscount
		? Math.round((1 - product.price / (product.compareAtPrice as number)) * 100)
		: 0;

	const handleAddToCart = (e: React.MouseEvent) => {
		e.preventDefault();
		addToCartMutation.mutate({
			productId: product.id,
			quantity: 1,
			price: product.price,
			productName: product.name,
			productSlug: product.slug,
			productImage: image,
		});
	};

	return (
		<Link
			href={`/products/${product.slug}`}
			className="group relative flex flex-col"
		>
			<div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
				{image ? (
					<img
						src={image}
						alt={product.name}
						className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
					</div>
				)}
				{hasDiscount && (
					<span className="absolute top-2.5 left-2.5 rounded-full bg-foreground px-2 py-0.5 font-medium text-background text-xs tabular-nums">
						&minus;{discountPct}%
					</span>
				)}
				{product.inventory === 0 && (
					<span className="absolute top-2.5 right-2.5 rounded-full bg-background/80 px-2 py-0.5 text-muted-foreground text-xs backdrop-blur-sm">
						Sold out
					</span>
				)}
				{product.inventory > 0 && (
					<div className="absolute inset-x-2.5 bottom-2.5 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
						<button
							type="button"
							onClick={handleAddToCart}
							disabled={addToCartMutation.isPending}
							className="w-full rounded-md bg-foreground/95 py-2 font-medium text-background text-xs backdrop-blur-sm transition-colors hover:bg-foreground disabled:opacity-50"
							aria-label={`Add ${product.name} to cart`}
						>
							{addToCartMutation.isPending ? "Adding…" : "Add to cart"}
						</button>
					</div>
				)}
			</div>
			<div className="mt-3 flex flex-col gap-0.5">
				<p className="line-clamp-1 text-foreground text-sm">{product.name}</p>
				<div className="flex items-baseline gap-1.5">
					<span className="text-foreground text-sm tabular-nums">
						{formatPrice(product.price)}
					</span>
					{hasDiscount && (
						<span className="text-muted-foreground text-xs tabular-nums line-through">
							{formatPrice(product.compareAtPrice as number)}
						</span>
					)}
				</div>
			</div>
		</Link>
	);
});

// ─── SearchResults ──────────────────────────────────────────────────────────

function SearchResults() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const api = useProductsApi();
	const track = useTrack();

	const urlQuery = searchParams.get("q") ?? "";
	const [search, setSearch] = useState(urlQuery);
	const [page, setPage] = useState(1);
	const [sort, setSort] = useState<"name" | "price" | "createdAt">("createdAt");
	const [order, setOrder] = useState<"asc" | "desc">("desc");
	const [category, setCategory] = useState("");
	const pageSize = 24;

	// Sync local search state when URL changes
	useEffect(() => {
		setSearch(urlQuery);
		setPage(1);
	}, [urlQuery]);

	const queryInput = useMemo(() => {
		const input: Record<string, string> = {
			page: String(page),
			limit: String(pageSize),
			sort,
			order,
		};
		if (urlQuery) input.search = urlQuery;
		if (category) input.category = category;
		return input;
	}, [page, sort, order, urlQuery, category]);

	const {
		data: productsData,
		isLoading,
		isError,
		refetch,
	} = api.listProducts.useQuery(urlQuery ? queryInput : undefined) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: categoriesData } = api.listCategories.useQuery() as {
		data: { categories: Category[] } | undefined;
	};

	const products = productsData?.products ?? [];
	const total = productsData?.total ?? 0;
	const categories = categoriesData?.categories ?? [];
	const totalPages = Math.ceil(total / pageSize);

	// Track search analytics (fires once results are available)
	const trackedRef = useRef<string>("");
	useEffect(() => {
		if (
			urlQuery &&
			!isLoading &&
			trackedRef.current !== `${urlQuery}:${total}`
		) {
			trackedRef.current = `${urlQuery}:${total}`;
			track({
				type: "search",
				data: { query: urlQuery, resultCount: total, source: "search_page" },
			});
		}
	}, [urlQuery, isLoading, total, track]);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (search.trim()) {
			router.push(`/search?q=${encodeURIComponent(search.trim())}`);
		} else {
			router.push("/search");
		}
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (search.trim()) {
				router.push(`/search?q=${encodeURIComponent(search.trim())}`);
			}
		}
	};

	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
			{/* Search header */}
			<div className="mb-8 sm:mb-10">
				<form onSubmit={handleSearch} className="relative max-w-2xl">
					<SearchIcon className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground" />
					<input
						ref={(el) => el?.focus()}
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						onKeyDown={handleInputKeyDown}
						placeholder="Search products…"
						aria-label="Search products"
						className="h-12 w-full rounded-xl border border-border bg-background pr-4 pl-12 text-base text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-foreground/5 sm:h-14 sm:text-lg"
					/>
				</form>
				{urlQuery && (
					<p className="mt-3 text-muted-foreground text-sm">
						{isLoading ? (
							"Searching…"
						) : (
							<>
								{total} {total === 1 ? "result" : "results"} for{" "}
								<span className="font-medium text-foreground">
									&ldquo;{urlQuery}&rdquo;
								</span>
							</>
						)}
					</p>
				)}
			</div>

			{/* No query state */}
			{!urlQuery && (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<LucideSearchIcon />
						</EmptyMedia>
						<EmptyTitle>Search our store</EmptyTitle>
						<EmptyDescription>
							Find products by name, description, or tags. Try searching for a
							category or keyword.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}

			{/* Results with filters */}
			{urlQuery && (
				<>
					{/* Sort & filter bar */}
					<div className="mb-6 flex flex-wrap items-center gap-2.5">
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
							<option value="createdAt:desc">Most relevant</option>
							<option value="price:asc">Price: Low to High</option>
							<option value="price:desc">Price: High to Low</option>
							<option value="name:asc">A to Z</option>
							<option value="name:desc">Z to A</option>
						</select>
					</div>

					{/* Error state */}
					{isError && (
						<div
							className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
							role="alert"
						>
							<p>Something went wrong loading search results.</p>
							<button
								type="button"
								onClick={() => refetch()}
								className="mt-1 font-medium underline"
							>
								Try again
							</button>
						</div>
					)}

					{/* Loading skeleton */}
					{isLoading && !isError && (
						<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
							{Array.from({ length: 8 }).map((_, i) => (
								<div key={`skeleton-${i}`}>
									<Skeleton className="aspect-[3/4] rounded-lg" />
									<div className="mt-3 flex flex-col gap-1.5">
										<Skeleton className="h-3.5 w-3/4" />
										<Skeleton className="h-3.5 w-1/3" />
									</div>
								</div>
							))}
						</div>
					)}

					{/* No results */}
					{!isLoading && !isError && products.length === 0 && (
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<LucideSearchIcon />
								</EmptyMedia>
								<EmptyTitle>No results found</EmptyTitle>
								<EmptyDescription>
									We couldn&apos;t find any products matching &ldquo;{urlQuery}
									&rdquo;. Try a different search term or browse our{" "}
									<Link href="/products">full catalog</Link>.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}

					{/* Product grid */}
					{!isLoading && !isError && products.length > 0 && (
						<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
							{products.map((product) => (
								<ProductCard key={product.id} product={product} />
							))}
						</div>
					)}

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="mt-10 flex items-center justify-center gap-1.5">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
								className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
							>
								Previous
							</button>
							<span className="px-3 text-muted-foreground text-sm tabular-nums">
								{page} / {totalPages}
							</span>
							<button
								type="button"
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
								className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function SearchPageClient() {
	return (
		<Suspense
			fallback={
				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
					<Skeleton className="h-14 max-w-2xl rounded-xl" />
				</div>
			}
		>
			<SearchResults />
		</Suspense>
	);
}
