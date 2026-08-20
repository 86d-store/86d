"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CategoryListTemplate from "./category-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	parentId?: string | null;
	image?: string | null;
	position: number;
	isVisible: boolean;
	createdAt: string;
	_count?: { products?: number };
}

interface ListResult {
	categories: Category[];
	total: number;
	page: number;
	limit: number;
}

const ROW_SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

// ─── Module Client ───────────────────────────────────────────────────────────

function useCategoriesAdminApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("products").admin["/admin/categories/list"],
		deleteCategory:
			client.module("products").admin["/admin/categories/:id/delete"],
	};
}

// ─── CategoryList ─────────────────────────────────────────────────────────────

interface CategoryListProps {
	onCreateNew?: () => void;
	onEdit?: (categoryId: string) => void;
}

export function CategoryList({ onCreateNew, onEdit }: CategoryListProps) {
	const api = useCategoriesAdminApi();

	const [page, setPage] = useState(1);
	const [deleting, setDeleting] = useState<string | null>(null);

	const limit = 20;

	const {
		data: categoriesData,
		isLoading: loading,
		isError: categoriesError,
		refetch: refetchCategories,
	} = api.listCategories.useQuery({
		page: String(page),
		limit: String(limit),
	}) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deleteMutation = api.deleteCategory.useMutation({
		onSettled: () => {
			setDeleting(null);
			void api.listCategories.invalidate();
		},
	});

	if (categoriesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load categories
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCategories()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const categories = categoriesData?.categories ?? [];
	const total = categoriesData?.total ?? 0;
	const totalPages = Math.ceil(total / limit);

	const handleDelete = (id: string) => {
		if (!window.confirm("Are you sure you want to delete this category?")) {
			return;
		}
		setDeleting(id);
		deleteMutation.mutate({ params: { id } });
	};

	const tableBody = loading ? (
		ROW_SKELETON_IDS.map((id) => (
			<tr key={`category-skeleton-${id}`}>
				<td className="px-4 py-3">
					<div className="h-4 w-28 animate-pulse rounded bg-muted" />
				</td>
				<td className="px-4 py-3">
					<div className="h-4 w-24 animate-pulse rounded bg-muted" />
				</td>
				<td className="px-4 py-3">
					<div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
				</td>
				<td className="px-4 py-3">
					<div className="h-4 w-8 animate-pulse rounded bg-muted" />
				</td>
				<td className="px-4 py-3">
					<div className="h-4 w-8 animate-pulse rounded bg-muted" />
				</td>
				<td className="px-4 py-3">
					<div className="h-4 w-24 animate-pulse rounded bg-muted" />
				</td>
			</tr>
		))
	) : categories.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
				<p className="font-medium text-foreground">No categories found</p>
				<p className="mt-1 text-sm">
					Create your first category to organize products.
				</p>
			</td>
		</tr>
	) : (
		categories.map((cat) => (
			<tr key={cat.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
				<td className="px-4 py-3 font-mono text-muted-foreground">
					{cat.slug}
				</td>
				<td className="px-4 py-3">
					{cat.isVisible ? (
						<span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:bg-emerald-950 dark:text-emerald-300">
							Visible
						</span>
					) : (
						<span className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
							Hidden
						</span>
					)}
				</td>
				<td className="px-4 py-3 text-foreground">{cat.position}</td>
				<td className="px-4 py-3 text-foreground">
					{cat._count?.products ?? 0}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={() => onEdit?.(cat.id)}
							className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => handleDelete(cat.id)}
							disabled={deleting === cat.id}
							className="rounded-md px-2 py-1 text-destructive text-xs transition-colors hover:bg-destructive/10 disabled:opacity-50"
						>
							{deleting === cat.id ? "Deleting..." : "Delete"}
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<CategoryListTemplate
			total={total}
			onCreateNew={onCreateNew}
			tableBody={tableBody}
			totalPages={totalPages}
			page={page}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
		/>
	);
}
