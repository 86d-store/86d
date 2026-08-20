"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { STATUS_COLORS } from "./_shared";

function useProductFeedsApi() {
	const client = useModuleClient();
	return {
		list: client.module("product-feeds").admin["/admin/product-feeds"],
	};
}

interface ProductFeed {
	id: string;
	name: string;
	type: string;
	url?: string;
	status: "active" | "paused" | "error";
	productCount?: number;
	lastSyncedAt?: string;
	createdAt: string;
}

export function ProductFeedsOverview() {
	const api = useProductFeedsApi();
	const {
		data,
		isLoading,
		isError: feedsError,
		refetch: refetchFeeds,
	} = api.list.useQuery({}) as {
		data: { feeds?: ProductFeed[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (feedsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load product feeds
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchFeeds()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const feeds = data?.feeds ?? [];

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Product Feeds</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage product data feeds for Google Shopping, Meta, and other
						channels
					</p>
				</div>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : feeds.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No product feeds configured. Set up feeds to syndicate your products
						to Google Shopping, Meta Commerce, and more.
					</p>
				</div>
			) : (
				<div className="rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b text-left">
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Feed
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Type
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Products
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{feeds.map((feed) => (
								<tr key={feed.id} className="hover:bg-muted/50">
									<td className="px-4 py-3">
										<p className="font-medium text-foreground text-sm">
											{feed.name}
										</p>
										{feed.url ? (
											<p className="truncate text-muted-foreground text-xs">
												{feed.url}
											</p>
										) : null}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{feed.type}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{feed.productCount ?? 0}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[feed.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{feed.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
