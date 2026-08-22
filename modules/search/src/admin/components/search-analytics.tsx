"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

interface AnalyticsData {
	totalQueries: number;
	uniqueTerms: number;
	avgResultCount: number;
	zeroResultCount: number;
	zeroResultRate: number;
	clickThroughRate: number;
	avgClickPosition: number;
	indexedItems: number;
}

interface PopularTerm {
	term: string;
	count: number;
	avgResultCount: number;
}

interface Synonym {
	id: string;
	term: string;
	synonyms: string[];
	createdAt: string;
}

type ProviderStatus = "connected" | "not_configured" | "error";

interface SearchSettings {
	meilisearch: {
		status: ProviderStatus;
		error?: string;
		configured: boolean;
		host: string | null;
		apiKey: string | null;
		indexUid: string;
		documentCount?: number;
	};
	embeddings: {
		status: ProviderStatus;
		error?: string;
		configured: boolean;
		provider: "openai" | "openrouter" | null;
		model: string;
	};
	indexCount: number;
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useSearchAdminApi() {
	const client = useModuleClient();
	return {
		settings: client.module("search").admin["/admin/search/settings"],
		analytics: client.module("search").admin["/admin/search/analytics"],
		popular: client.module("search").admin["/admin/search/popular"],
		zeroResults: client.module("search").admin["/admin/search/zero-results"],
		synonyms: client.module("search").admin["/admin/search/synonyms"],
		addSynonym: client.module("search").admin["/admin/search/synonyms/add"],
		removeSynonym:
			client.module("search").admin["/admin/search/synonyms/:id/delete"],
	};
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border border-border bg-background p-4">
			<p className="text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-semibold text-2xl text-foreground">{value}</p>
		</div>
	);
}

function StatusBadge({
	status,
	label,
	testId,
}: {
	status: ProviderStatus;
	label: string;
	testId?: string;
}) {
	const palette =
		status === "connected"
			? {
					bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
					dot: "bg-emerald-500",
				}
			: status === "error"
				? {
						bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
						dot: "bg-red-500",
					}
				: {
						bg: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
						dot: "bg-amber-500",
					};
	return (
		<span
			data-testid={testId}
			className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ${palette.bg}`}
		>
			<span className={`inline-block size-1.5 rounded-full ${palette.dot}`} />
			{label}
		</span>
	);
}

export function SearchAnalytics() {
	const api = useSearchAdminApi();
	const [newTerm, setNewTerm] = useState("");
	const [newSynonyms, setNewSynonyms] = useState("");
	const [error, setError] = useState("");

	const { data: settingsData } = api.settings.useQuery({}) as {
		data: SearchSettings | undefined;
	};

	const { data: analyticsData, isLoading: analyticsLoading } =
		api.analytics.useQuery({}) as {
			data: { analytics: AnalyticsData } | undefined;
			isLoading: boolean;
		};

	const { data: popularData, isLoading: popularLoading } = api.popular.useQuery(
		{ limit: "15" },
	) as {
		data: { terms: PopularTerm[] } | undefined;
		isLoading: boolean;
	};

	const { data: zeroData, isLoading: zeroLoading } = api.zeroResults.useQuery({
		limit: "15",
	}) as {
		data: { terms: PopularTerm[] } | undefined;
		isLoading: boolean;
	};

	const { data: synonymsData, isLoading: synonymsLoading } =
		api.synonyms.useQuery({}) as {
			data: { synonyms: Synonym[] } | undefined;
			isLoading: boolean;
		};

	const addMutation = api.addSynonym.useMutation({
		onSettled: () => {
			void api.synonyms.invalidate();
			setNewTerm("");
			setNewSynonyms("");
		},
		onError: () => {
			setError("Failed to add synonym.");
		},
	});

	const removeMutation = api.removeSynonym.useMutation({
		onSettled: () => {
			void api.synonyms.invalidate();
		},
	});

	const analytics = analyticsData?.analytics;
	const popularTerms = popularData?.terms ?? [];
	const zeroResultTerms = zeroData?.terms ?? [];
	const synonyms = synonymsData?.synonyms ?? [];
	const loading =
		analyticsLoading || popularLoading || zeroLoading || synonymsLoading;

	const handleAddSynonym = () => {
		setError("");
		const term = newTerm.trim();
		const syns = newSynonyms
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		if (!term || syns.length === 0) {
			setError("Enter a term and at least one synonym.");
			return;
		}
		addMutation.mutate({ term, synonyms: syns });
	};

	if (loading && !analytics) {
		return (
			<div className="space-y-6">
				<h1 className="font-bold text-2xl text-foreground">Search</h1>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
						<Skeleton key={key} className="h-20 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 w-full rounded-lg" />
				<div className="grid gap-6 sm:grid-cols-2">
					<Skeleton className="h-48 rounded-lg" />
					<Skeleton className="h-48 rounded-lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<h1 className="font-bold text-2xl text-foreground">Search</h1>
			{/* Search engine configuration */}
			{settingsData && (
				<div className="rounded-lg border border-border bg-background p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Search Configuration
					</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									MeiliSearch
								</span>
								<StatusBadge
									testId={`meili-status-${settingsData.meilisearch.status.replace("_", "-")}`}
									status={settingsData.meilisearch.status}
									label={
										settingsData.meilisearch.status === "connected"
											? "Connected"
											: settingsData.meilisearch.status === "error"
												? "Connection Error"
												: "Not configured"
									}
								/>
							</div>
							{settingsData.meilisearch.status === "connected" ? (
								<div className="text-muted-foreground text-xs">
									<p>Host: {settingsData.meilisearch.host}</p>
									<p>Index: {settingsData.meilisearch.indexUid}</p>
									<p>Key: {settingsData.meilisearch.apiKey}</p>
									{typeof settingsData.meilisearch.documentCount ===
									"number" ? (
										<p>
											Documents:{" "}
											{settingsData.meilisearch.documentCount.toLocaleString()}
										</p>
									) : null}
								</div>
							) : settingsData.meilisearch.status === "error" ? (
								<div
									data-testid="meili-error-details"
									className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-red-600 text-xs dark:text-red-400"
								>
									<p className="font-medium">
										MeiliSearch at{" "}
										{settingsData.meilisearch.host ?? "configured host"} is
										unreachable.
									</p>
									{settingsData.meilisearch.error ? (
										<p className="mt-1 font-mono opacity-90">
											{settingsData.meilisearch.error}
										</p>
									) : null}
									<p className="mt-1.5 text-[11px] text-muted-foreground">
										Falling back to the local search engine. Verify the instance
										URL and master key.
									</p>
								</div>
							) : (
								<p className="text-muted-foreground text-xs">
									Using local search engine. Configure{" "}
									<code className="rounded bg-muted px-1 text-[11px]">
										MEILISEARCH_HOST
									</code>{" "}
									and{" "}
									<code className="rounded bg-muted px-1 text-[11px]">
										MEILISEARCH_API_KEY
									</code>{" "}
									for dedicated search.
								</p>
							)}
						</div>
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									AI Embeddings
								</span>
								<StatusBadge
									testId={`embeddings-status-${settingsData.embeddings.status.replace("_", "-")}`}
									status={settingsData.embeddings.status}
									label={
										settingsData.embeddings.status === "connected"
											? settingsData.embeddings.provider === "openai"
												? "OpenAI"
												: "OpenRouter"
											: settingsData.embeddings.status === "error"
												? "Connection Error"
												: "Not configured"
									}
								/>
							</div>
							{settingsData.embeddings.status === "connected" ? (
								<p className="text-muted-foreground text-xs">
									Model: {settingsData.embeddings.model}
								</p>
							) : settingsData.embeddings.status === "error" ? (
								<div
									data-testid="embeddings-error-details"
									className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-red-600 text-xs dark:text-red-400"
								>
									<p className="font-medium">
										{settingsData.embeddings.provider === "openai"
											? "OpenAI"
											: settingsData.embeddings.provider === "openrouter"
												? "OpenRouter"
												: "Embedding provider"}{" "}
										rejected the configured key.
									</p>
									{settingsData.embeddings.error ? (
										<p className="mt-1 font-mono opacity-90">
											{settingsData.embeddings.error}
										</p>
									) : null}
									<p className="mt-1.5 text-[11px] text-muted-foreground">
										Semantic search is disabled until the key is replaced.
									</p>
								</div>
							) : (
								<p className="text-muted-foreground text-xs">
									Semantic search disabled. Configure{" "}
									<code className="rounded bg-muted px-1 text-[11px]">
										OPENAI_API_KEY
									</code>{" "}
									for AI-powered results.
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Stats overview */}
			{analytics && (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
					<StatCard
						label="Total Searches"
						value={analytics.totalQueries.toLocaleString()}
					/>
					<StatCard
						label="Unique Terms"
						value={analytics.uniqueTerms.toLocaleString()}
					/>
					<StatCard label="Avg Results" value={analytics.avgResultCount} />
					<StatCard
						label="Zero Results"
						value={analytics.zeroResultCount.toLocaleString()}
					/>
					<StatCard
						label="Zero Result Rate"
						value={`${analytics.zeroResultRate}%`}
					/>
					<StatCard
						label="Click-Through Rate"
						value={`${analytics.clickThroughRate}%`}
					/>
					<StatCard
						label="Avg Click Position"
						value={
							analytics.avgClickPosition > 0 ? analytics.avgClickPosition : "—"
						}
					/>
					<StatCard
						label="Indexed Items"
						value={analytics.indexedItems.toLocaleString()}
					/>
				</div>
			)}

			<div className="grid gap-8 md:grid-cols-2">
				{/* Popular terms */}
				<div className="rounded-lg border border-border bg-background">
					<div className="border-border border-b px-5 py-3">
						<h3 className="font-medium text-foreground text-sm">
							Popular Search Terms
						</h3>
					</div>
					{popularTerms.length === 0 ? (
						<p className="px-5 py-6 text-center text-muted-foreground text-sm">
							No search data yet.
						</p>
					) : (
						<div className="divide-y divide-border">
							{popularTerms.map((t) => (
								<div
									key={t.term}
									className="flex items-center justify-between px-5 py-2.5"
								>
									<span className="text-foreground text-sm">{t.term}</span>
									<span className="text-muted-foreground text-xs">
										{t.count} searches &middot; {t.avgResultCount} avg results
									</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Zero result queries */}
				<div className="rounded-lg border border-border bg-background">
					<div className="border-border border-b px-5 py-3">
						<h3 className="font-medium text-foreground text-sm">
							Zero-Result Queries
						</h3>
					</div>
					{zeroResultTerms.length === 0 ? (
						<p className="px-5 py-6 text-center text-muted-foreground text-sm">
							No zero-result queries yet.
						</p>
					) : (
						<div className="divide-y divide-border">
							{zeroResultTerms.map((t) => (
								<div
									key={t.term}
									className="flex items-center justify-between px-5 py-2.5"
								>
									<span className="text-foreground text-sm">{t.term}</span>
									<span className="text-muted-foreground text-xs">
										{t.count} times
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Synonyms management */}
			<div className="rounded-lg border border-border bg-background">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-medium text-foreground text-sm">
						Search Synonyms
					</h3>
				</div>
				<div className="p-5">
					<div className="mb-4 flex flex-col gap-2 sm:flex-row">
						<input
							type="text"
							value={newTerm}
							onChange={(e) => setNewTerm(e.target.value)}
							placeholder="Term (e.g. tee)"
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<input
							type="text"
							value={newSynonyms}
							onChange={(e) => setNewSynonyms(e.target.value)}
							placeholder="Synonyms, comma separated (e.g. t-shirt, shirt)"
							className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<button
							type="button"
							onClick={handleAddSynonym}
							disabled={addMutation.isPending}
							className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							Add
						</button>
					</div>
					{error && <p className="mb-3 text-destructive text-sm">{error}</p>}
					{synonyms.length === 0 ? (
						<p className="py-4 text-center text-muted-foreground text-sm">
							No synonyms configured yet.
						</p>
					) : (
						<div className="divide-y divide-border rounded-md border border-border">
							{synonyms.map((syn) => (
								<div
									key={syn.id}
									className="flex items-center justify-between px-4 py-2.5"
								>
									<div className="text-sm">
										<span className="font-medium text-foreground">
											{syn.term}
										</span>
										<span className="mx-2 text-muted-foreground">&rarr;</span>
										<span className="text-muted-foreground">
											{syn.synonyms.join(", ")}
										</span>
									</div>
									<button
										type="button"
										onClick={() =>
											removeMutation.mutate({
												params: { id: syn.id },
											})
										}
										className="text-muted-foreground text-xs hover:text-destructive"
									>
										Remove
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
