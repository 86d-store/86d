"use client";

import { useSearchApi } from "./_hooks";

interface SearchResult {
	id: string;
	entityType: string;
	entityId: string;
	title: string;
	url: string;
	image?: string;
	score: number;
}

interface SearchResultsProps {
	query: string;
	entityType?: string | undefined;
	sessionId?: string | undefined;
	limit?: number | undefined;
}

export function SearchResults({
	query,
	entityType,
	sessionId,
	limit = 20,
}: SearchResultsProps) {
	const api = useSearchApi();

	const { data, isLoading } =
		query.trim().length > 0
			? (api.search.useQuery({
					q: query.trim(),
					type: entityType,
					limit: String(limit),
					sessionId,
				}) as {
					data: { results: SearchResult[]; total: number } | undefined;
					isLoading: boolean;
				})
			: { data: undefined, isLoading: false };

	const results = data?.results ?? [];
	const total = data?.total ?? 0;

	if (!query.trim()) return null;

	if (isLoading) {
		return (
			<div className="space-y-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={`skel-${i}`}
						className="flex items-start gap-4 rounded-lg border border-border p-4"
					>
						<div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-md bg-muted" />
						<div className="flex-1 space-y-2 pt-0.5">
							<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
							<div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (results.length === 0) {
		return (
			<div className="py-12 text-center">
				<p className="text-foreground">
					No results found for &ldquo;{query}&rdquo;
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Try different keywords or check the spelling.
				</p>
			</div>
		);
	}

	return (
		<div>
			<p className="mb-4 text-muted-foreground text-sm">
				{total} result{total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
			</p>
			<div className="space-y-3">
				{results.map((result) => (
					<a
						key={result.id}
						href={result.url}
						className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
					>
						<div className="flex items-start gap-4">
							{result.image && (
								<img
									src={result.image}
									alt=""
									className="h-16 w-16 rounded-md object-cover"
								/>
							)}
							<div className="min-w-0 flex-1">
								<h3 className="font-medium text-foreground">{result.title}</h3>
								<p className="mt-0.5 text-muted-foreground text-xs capitalize">
									{result.entityType}
								</p>
							</div>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
