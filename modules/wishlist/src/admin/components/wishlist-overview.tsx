"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import WishlistOverviewTemplate from "./wishlist-overview.mdx";

interface WishlistItem {
	id: string;
	customerId: string;
	customerEmail?: string;
	productId: string;
	productName: string;
	productImage?: string;
	note?: string;
	addedAt: string;
}

interface WishlistSummary {
	totalItems: number;
	topProducts: Array<{ productId: string; productName: string; count: number }>;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useWishlistAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("wishlist").admin["/admin/wishlist"],
		summary: client.module("wishlist").admin["/admin/wishlist/summary"],
		deleteItem: client.module("wishlist").admin["/admin/wishlist/:id/delete"],
	};
}

export function WishlistOverview() {
	const api = useWishlistAdminApi();
	const [skip, setSkip] = useState(0);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: summaryData, isLoading: summaryLoading } = api.summary.useQuery(
		{},
	) as {
		data: { summary: WishlistSummary } | undefined;
		isLoading: boolean;
	};

	const { data: listData, isLoading: listLoading } = api.listAll.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
	}) as {
		data: { items: WishlistItem[]; total: number } | undefined;
		isLoading: boolean;
	};

	const summary = summaryData?.summary;
	const items = listData?.items ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteItem.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listAll.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete wishlist item."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const loading = summaryLoading || listLoading;

	const itemsContent = loading ? (
		<div className="rounded-lg border border-border bg-card">
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<tbody className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, _i) => (
							<tr key={rowKey}>
								{Array.from({ length: 4 }, (_, _j) => (
									<td key={cellKey} className="px-5 py-3">
										<Skeleton className="h-4 rounded" />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="space-y-3 p-4 md:hidden">
				{Array.from({ length: 3 }, (_, _i) => (
					<Skeleton key={key} className="h-16 rounded-lg" />
				))}
			</div>
		</div>
	) : items.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No wishlist items yet.
		</div>
	) : (
		<>
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<thead className="border-border border-b bg-muted/50">
						<tr>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Product
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Customer
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Added
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{items.map((item) => (
							<tr key={item.id}>
								<td className="px-5 py-3">
									<span className="text-foreground">{item.productName}</span>
									{item.note && (
										<span className="ml-2 text-muted-foreground text-xs">
											{item.note}
										</span>
									)}
								</td>
								<td className="px-5 py-3 text-muted-foreground text-sm">
									{item.customerEmail ?? `${item.customerId.slice(0, 8)}…`}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(item.addedAt)}
								</td>
								<td className="px-5 py-3">
									{deleteConfirm === item.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(item.id)}
												className="font-medium text-destructive text-xs hover:opacity-80"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setDeleteConfirm(null)}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setDeleteConfirm(item.id)}
											className="text-muted-foreground text-xs hover:text-destructive"
										>
											Delete
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="divide-y divide-border md:hidden">
				{items.map((item) => (
					<div key={item.id} className="px-5 py-3">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									{item.productName}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{item.customerEmail ?? `${item.customerId.slice(0, 8)}…`}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{formatDate(item.addedAt)}
								</p>
							</div>
							{deleteConfirm === item.id ? (
								<span className="space-x-2">
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
										className="font-medium text-destructive text-xs"
									>
										Confirm
									</button>
									<button
										type="button"
										onClick={() => setDeleteConfirm(null)}
										className="text-muted-foreground text-xs"
									>
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									onClick={() => setDeleteConfirm(item.id)}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={skip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setSkip((s) => s + PAGE_SIZE)}
							disabled={skip + PAGE_SIZE >= total}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	return (
		<WishlistOverviewTemplate
			summary={summary}
			error={error}
			itemsContent={itemsContent}
		/>
	);
}
