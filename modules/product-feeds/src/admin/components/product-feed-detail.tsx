"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { STATUS_COLORS } from "./_shared";

interface FeedDetail {
	id: string;
	name: string;
	slug?: string;
	channel?: string;
	format?: string;
	status: string;
	country?: string;
	currency?: string;
	language?: string;
	fieldMappings?: Array<{
		sourceField: string;
		targetField: string;
		transform?: string;
	}>;
	itemCount?: number;
	errorCount?: number;
	warningCount?: number;
	lastGeneratedAt?: string;
	createdAt: string;
	updatedAt?: string;
}

interface FeedItem {
	id: string;
	productId: string;
	status: string;
	issues?: string[];
}

interface CategoryMapping {
	id: string;
	storeCategory: string;
	channelCategory: string;
}

export function ProductFeedDetail({
	params,
}: {
	params?: Record<string, string>;
}) {
	const id = params?.id ?? "";
	const client = useModuleClient();
	const feedApi =
		client.module("product-feeds").admin["/admin/product-feeds/:id"];
	const itemsApi =
		client.module("product-feeds").admin["/admin/product-feeds/:id/items"];
	const mappingsApi =
		client.module("product-feeds").admin["/admin/product-feeds/:id/mappings"];

	const { data, isLoading } = feedApi.useQuery({ id }) as {
		data: { feed?: FeedDetail } | undefined;
		isLoading: boolean;
	};

	const { data: itemsData } = itemsApi.useQuery({ id }) as {
		data: { items?: FeedItem[] } | undefined;
	};

	const { data: mappingsData } = mappingsApi.useQuery({ id }) as {
		data: { mappings?: CategoryMapping[] } | undefined;
	};

	const feed = data?.feed;
	const items = itemsData?.items ?? [];
	const mappings = mappingsData?.mappings ?? [];

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/product-feeds"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Product Feeds
					</a>
				</div>
				<div className="space-y-4">
					<div className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
					<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
				</div>
			</div>
		);
	}

	if (!feed) {
		return (
			<div>
				<div className="mb-6">
					<a
						href="/admin/product-feeds"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Product Feeds
					</a>
				</div>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Feed not found.</p>
				</div>
			</div>
		);
	}

	const ITEM_STATUS_COLORS: Record<string, string> = {
		valid:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		warning:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		excluded: "bg-muted text-muted-foreground",
	};

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/product-feeds"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to Product Feeds
				</a>
			</div>

			{/* Header */}
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="font-bold text-2xl text-foreground">{feed.name}</h1>
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${STATUS_COLORS[feed.status] ?? "bg-muted text-muted-foreground"}`}
						>
							{feed.status}
						</span>
					</div>
					{feed.channel ? (
						<p className="mt-1 text-muted-foreground text-sm capitalize">
							{feed.channel.replace(/-/g, " ")}
							{feed.format ? ` · ${feed.format.toUpperCase()}` : ""}
						</p>
					) : null}
				</div>
			</div>

			{/* Stats row */}
			<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Products</p>
					<p className="mt-1 font-bold text-2xl text-foreground">
						{feed.itemCount ?? 0}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Errors</p>
					<p className="mt-1 font-bold text-2xl text-red-600">
						{feed.errorCount ?? 0}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Warnings</p>
					<p className="mt-1 font-bold text-2xl text-yellow-600">
						{feed.warningCount ?? 0}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs">Last Sync</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						{feed.lastGeneratedAt
							? new Date(feed.lastGeneratedAt).toLocaleDateString()
							: "Never"}
					</p>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Left column */}
				<div className="space-y-6 lg:col-span-2">
					{/* Field mappings */}
					{feed.fieldMappings && feed.fieldMappings.length > 0 ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="border-border border-b px-4 py-3">
								<h2 className="font-semibold text-foreground text-sm">
									Field Mappings
								</h2>
							</div>
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Source
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Target
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Transform
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{feed.fieldMappings.map((fm, i) => (
										<tr key={`fm-${i}`}>
											<td className="px-4 py-2.5 font-mono text-foreground text-sm">
												{fm.sourceField}
											</td>
											<td className="px-4 py-2.5 font-mono text-foreground text-sm">
												{fm.targetField}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm">
												{fm.transform ?? "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}

					{/* Feed items */}
					{items.length > 0 ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="border-border border-b px-4 py-3">
								<h2 className="font-semibold text-foreground text-sm">
									Feed Items ({items.length})
								</h2>
							</div>
							<table className="w-full">
								<thead>
									<tr className="border-border border-b text-left">
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Product ID
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Status
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground text-xs"
										>
											Issues
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{items.slice(0, 50).map((item) => (
										<tr key={item.id}>
											<td className="px-4 py-2.5 font-mono text-foreground text-sm">
												{item.productId.slice(0, 12)}...
											</td>
											<td className="px-4 py-2.5">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${ITEM_STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground"}`}
												>
													{item.status}
												</span>
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-sm">
												{item.issues?.length ? item.issues.join(", ") : "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
				</div>

				{/* Right column */}
				<div className="space-y-6">
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Configuration
						</h3>
						<dl className="space-y-2 text-sm">
							{feed.country ? (
								<div>
									<dt className="text-muted-foreground">Country</dt>
									<dd className="font-medium text-foreground">
										{feed.country}
									</dd>
								</div>
							) : null}
							{feed.currency ? (
								<div>
									<dt className="text-muted-foreground">Currency</dt>
									<dd className="font-medium text-foreground">
										{feed.currency}
									</dd>
								</div>
							) : null}
							{feed.language ? (
								<div>
									<dt className="text-muted-foreground">Language</dt>
									<dd className="font-medium text-foreground">
										{feed.language}
									</dd>
								</div>
							) : null}
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium text-foreground">
									{new Date(feed.createdAt).toLocaleDateString()}
								</dd>
							</div>
						</dl>
					</div>

					{/* Category mappings */}
					{mappings.length > 0 ? (
						<div className="rounded-lg border border-border bg-card p-4">
							<h3 className="mb-3 font-semibold text-foreground text-sm">
								Category Mappings
							</h3>
							<div className="space-y-2">
								{mappings.map((m) => (
									<div
										key={m.id}
										className="rounded-md bg-muted/50 p-2 text-sm"
									>
										<p className="text-foreground">{m.storeCategory}</p>
										<p className="text-muted-foreground text-xs">
											→ {m.channelCategory}
										</p>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
