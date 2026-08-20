"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import RecentlyViewedAdminTemplate from "./recently-viewed-admin.mdx";

interface ViewItem {
	id: string;
	customerId?: string;
	sessionId?: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string;
	productPrice?: number;
	viewedAt: string;
}

interface PopularProduct {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string;
	viewCount: number;
}

const PAGE_SIZE = 30;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
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

function useRecentlyViewedAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("recently-viewed").admin["/admin/recently-viewed"],
		popular:
			client.module("recently-viewed").admin["/admin/recently-viewed/popular"],
		deleteView:
			client.module("recently-viewed").admin[
				"/admin/recently-viewed/:id/delete"
			],
	};
}

export function RecentlyViewedAdmin() {
	const api = useRecentlyViewedAdminApi();
	const [skip, setSkip] = useState(0);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: popularData, isLoading: popularLoading } = api.popular.useQuery(
		{ take: "10" },
	) as {
		data: { products: PopularProduct[] } | undefined;
		isLoading: boolean;
	};

	const { data: listData, isLoading: listLoading } = api.listAll.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
	}) as {
		data: { views: ViewItem[]; total: number } | undefined;
		isLoading: boolean;
	};

	const popular = popularData?.products ?? [];
	const views = listData?.views ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteView.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listAll.invalidate();
			void api.popular.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete view."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const loading = popularLoading || listLoading;

	const viewsContent = loading ? (
		<div className="rounded-lg border border-border bg-card">
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<tbody className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, i) => (
							<tr key={`skeleton-${i}`}>
								{Array.from({ length: 5 }, (_, j) => (
									<td key={`skeleton-cell-${j}`} className="px-5 py-3">
										<Skeleton className="h-4 rounded" />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="space-y-3 p-4 md:hidden">
				{Array.from({ length: 3 }, (_, i) => (
					<Skeleton key={`mobile-skeleton-${i}`} className="h-16 rounded-lg" />
				))}
			</div>
		</div>
	) : views.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No product views recorded yet.
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
								Viewer
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Price
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Viewed
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
						{views.map((view) => (
							<tr key={view.id}>
								<td className="px-5 py-3">
									<span className="text-foreground">{view.productName}</span>
								</td>
								<td className="px-5 py-3 font-mono text-muted-foreground text-xs">
									{view.customerId
										? `${view.customerId.slice(0, 8)}...`
										: view.sessionId
											? `session:${view.sessionId.slice(0, 6)}`
											: "anonymous"}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{view.productPrice != null
										? formatPrice(view.productPrice)
										: "—"}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(view.viewedAt)}
								</td>
								<td className="px-5 py-3">
									{deleteConfirm === view.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(view.id)}
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
											onClick={() => setDeleteConfirm(view.id)}
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
				{views.map((view) => (
					<div key={view.id} className="px-5 py-3">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									{view.productName}
								</p>
								<p className="mt-0.5 font-mono text-muted-foreground text-xs">
									{view.customerId
										? `Customer: ${view.customerId.slice(0, 8)}...`
										: view.sessionId
											? `Session: ${view.sessionId.slice(0, 6)}`
											: "Anonymous"}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{formatDate(view.viewedAt)}
								</p>
							</div>
							{deleteConfirm === view.id ? (
								<span className="space-x-2">
									<button
										type="button"
										onClick={() => handleDelete(view.id)}
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
									onClick={() => setDeleteConfirm(view.id)}
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
		<RecentlyViewedAdminTemplate
			popular={popular}
			total={total}
			error={error}
			viewsContent={viewsContent}
			formatPrice={formatPrice}
		/>
	);
}
