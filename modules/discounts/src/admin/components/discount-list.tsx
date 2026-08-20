"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import DiscountListTemplate from "./discount-list.mdx";

interface Discount {
	id: string;
	name: string;
	type: "percentage" | "fixed_amount" | "free_shipping";
	value: number;
	isActive: boolean;
	usedCount: number;
	maximumUses?: number | null;
	startsAt?: string | null;
	endsAt?: string | null;
}

interface ListResult {
	discounts: Discount[];
	total: number;
	pages: number;
}

function formatValue(type: string, value: number): string {
	if (type === "percentage") return `${value}%`;
	if (type === "fixed_amount") {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(value / 100);
	}
	return "Free shipping";
}

function useDiscountsAdminApi() {
	const client = useModuleClient();
	return {
		listDiscounts: client.module("discounts").admin["/admin/discounts"],
		updateDiscount:
			client.module("discounts").admin["/admin/discounts/:id/update"],
		deleteDiscount:
			client.module("discounts").admin["/admin/discounts/:id/delete"],
	};
}

const PAGE_SIZE = 20;

export function DiscountList() {
	const api = useDiscountsAdminApi();
	const [page, setPage] = useState(1);
	const [isActiveFilter, setIsActiveFilter] = useState("");

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (isActiveFilter !== "") queryInput.isActive = isActiveFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: discountsError,
		refetch: refetchDiscounts,
	} = api.listDiscounts.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const discounts = listData?.discounts ?? [];
	const total = listData?.total ?? 0;
	const totalPages = listData?.pages ?? 1;

	const deleteMutation = api.deleteDiscount.useMutation({
		onSettled: () => {
			void api.listDiscounts.invalidate();
		},
	});

	const toggleMutation = api.updateDiscount.useMutation({
		onSettled: () => {
			void api.listDiscounts.invalidate();
		},
	});

	if (discountsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load discounts
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchDiscounts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const handleDelete = (id: string) => {
		if (!confirm("Delete this discount? This cannot be undone.")) return;
		deleteMutation.mutate({ params: { id } });
	};

	const handleToggle = (id: string, isActive: boolean) => {
		toggleMutation.mutate({ params: { id }, isActive: !isActive });
	};

	const subtitle = `${total} ${total === 1 ? "discount" : "discounts"}`;

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 6 }).map((_, j) => (
					<td key={`cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : discounts.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No discounts yet</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create discounts to offer promotions to your customers
				</p>
			</td>
		</tr>
	) : (
		discounts.map((discount) => (
			<tr
				key={discount.id}
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={() => {
					window.location.href = `/admin/discounts/${discount.id}`;
				}}
			>
				<td className="px-4 py-3 font-medium text-foreground text-sm">
					<a
						href={`/admin/discounts/${discount.id}`}
						className="hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{discount.name}
					</a>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm capitalize sm:table-cell">
					{discount.type.replace(/_/g, " ")}
				</td>
				<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
					{formatValue(discount.type, discount.value)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-sm md:table-cell">
					{discount.usedCount}
					{discount.maximumUses != null && ` / ${discount.maximumUses}`}
				</td>
				<td className="px-4 py-3 text-center">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
							discount.isActive
								? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{discount.isActive ? "Active" : "Inactive"}
					</span>
				</td>
				<td
					className="px-4 py-3 text-right"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-end gap-1">
						<button
							type="button"
							onClick={() => handleToggle(discount.id, discount.isActive)}
							className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
						>
							{discount.isActive ? "Deactivate" : "Activate"}
						</button>
						<button
							type="button"
							onClick={() => handleDelete(discount.id)}
							className="rounded-md px-2.5 py-1.5 font-medium text-destructive text-xs transition-colors hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<DiscountListTemplate
			subtitle={subtitle}
			isActiveFilter={isActiveFilter}
			onFilterChange={(v: string) => {
				setIsActiveFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
		/>
	);
}
