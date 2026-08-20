"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

function useSitemapApi() {
	const client = useModuleClient();
	return {
		config: client.module("sitemap").admin["/admin/sitemap/config"],
		stats: client.module("sitemap").admin["/admin/sitemap/stats"],
		entries: client.module("sitemap").admin["/admin/sitemap/entries"],
		regenerate: client.module("sitemap").admin["/admin/sitemap/regenerate"],
		removeEntry:
			client.module("sitemap").admin["/admin/sitemap/entries/:id/remove"],
	};
}

interface SitemapStats {
	totalEntries: number;
	entriesBySource: Record<string, number>;
	lastGenerated?: string;
}

interface SitemapConfig {
	baseUrl: string;
	includeProducts: boolean;
	includeCollections: boolean;
	includePages: boolean;
	includeBlog: boolean;
	includeBrands: boolean;
	lastGenerated?: string;
}

interface SitemapEntry {
	id: string;
	loc: string;
	changefreq: string;
	priority: number;
	source: string;
	lastmod?: string;
}

const SOURCE_LABELS: Record<string, string> = {
	static: "Static",
	product: "Products",
	collection: "Collections",
	page: "Pages",
	blog: "Blog",
	brand: "Brands",
	custom: "Custom",
};

export function SitemapAdmin() {
	const api = useSitemapApi();

	const { data: statsData, refetch: refetchStats } = api.stats.useQuery({}) as {
		data: { stats?: SitemapStats } | undefined;
		refetch: () => void;
	};

	const { data: configData } = api.config.useQuery({}) as {
		data: { config?: SitemapConfig } | undefined;
	};

	const {
		data: entriesData,
		refetch: refetchEntries,
		isError: entriesError,
	} = api.entries.useQuery({}) as {
		data: { entries?: SitemapEntry[]; total?: number } | undefined;
		refetch: () => void;
		isError: boolean;
	};

	const regenerateMutation = api.regenerate.useMutation() as {
		mutateAsync: (params: {
			body: Record<string, unknown>;
		}) => Promise<{ entriesGenerated: number }>;
		isPending: boolean;
	};

	const removeEntryMutation = api.removeEntry.useMutation() as {
		mutateAsync: (params: { params: { id: string } }) => Promise<unknown>;
	};

	if (entriesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load sitemap entries
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => void refetchEntries()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const stats = statsData?.stats;
	const config = configData?.config;
	const entries = entriesData?.entries ?? [];

	async function handleRegenerate() {
		await regenerateMutation.mutateAsync({ body: {} });
		refetchStats();
		refetchEntries();
	}

	async function handleRemoveEntry(id: string) {
		await removeEntryMutation.mutateAsync({ params: { id } });
		refetchStats();
		refetchEntries();
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Sitemap</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						XML sitemap generation for search engines
					</p>
				</div>
				<button
					type="button"
					onClick={handleRegenerate}
					disabled={regenerateMutation.isPending}
					className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
				>
					{regenerateMutation.isPending ? "Generating..." : "Regenerate"}
				</button>
			</div>

			{/* Stats */}
			{stats && (
				<div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-2xl text-foreground">
							{stats.totalEntries}
						</p>
						<p className="text-muted-foreground text-sm">Total URLs</p>
					</div>
					{Object.entries(stats.entriesBySource).map(([source, count]) => (
						<div
							key={source}
							className="rounded-lg border border-border bg-card p-4"
						>
							<p className="font-medium text-2xl text-foreground">{count}</p>
							<p className="text-muted-foreground text-sm">
								{SOURCE_LABELS[source] ?? source}
							</p>
						</div>
					))}
				</div>
			)}

			{/* Config summary */}
			{config && (
				<div className="mb-6 rounded-lg border border-border bg-card p-4">
					<h2 className="mb-2 font-medium text-foreground text-sm">
						Configuration
					</h2>
					<div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
						<div className="text-muted-foreground">
							Base URL:{" "}
							<span className="text-foreground">{config.baseUrl}</span>
						</div>
						<div className="text-muted-foreground">
							Products:{" "}
							<span className="text-foreground">
								{config.includeProducts ? "Yes" : "No"}
							</span>
						</div>
						<div className="text-muted-foreground">
							Collections:{" "}
							<span className="text-foreground">
								{config.includeCollections ? "Yes" : "No"}
							</span>
						</div>
						<div className="text-muted-foreground">
							Pages:{" "}
							<span className="text-foreground">
								{config.includePages ? "Yes" : "No"}
							</span>
						</div>
						<div className="text-muted-foreground">
							Blog:{" "}
							<span className="text-foreground">
								{config.includeBlog ? "Yes" : "No"}
							</span>
						</div>
						<div className="text-muted-foreground">
							Brands:{" "}
							<span className="text-foreground">
								{config.includeBrands ? "Yes" : "No"}
							</span>
						</div>
					</div>
					{config.lastGenerated && (
						<p className="mt-2 text-muted-foreground text-xs">
							Last generated: {new Date(config.lastGenerated).toLocaleString()}
						</p>
					)}
				</div>
			)}

			{/* Entries table */}
			{entries.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No sitemap entries yet. Click Regenerate to build the sitemap from
						your store data.
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
									URL
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Source
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Priority
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Freq
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{entries.map((entry) => (
								<tr key={entry.id} className="hover:bg-muted/50">
									<td className="max-w-xs truncate px-4 py-3">
										<code className="text-foreground text-sm">{entry.loc}</code>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{SOURCE_LABELS[entry.source] ?? entry.source}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{entry.priority}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{entry.changefreq}
									</td>
									<td className="px-4 py-3">
										{entry.source === "custom" && (
											<button
												type="button"
												onClick={() => handleRemoveEntry(entry.id)}
												className="text-destructive text-sm hover:underline"
											>
												Remove
											</button>
										)}
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
