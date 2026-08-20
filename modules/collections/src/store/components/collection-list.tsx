"use client";

import { useCollectionsApi } from "./_hooks";
import CollectionListTemplate from "./collection-list.mdx";

interface CollectionData {
	id: string;
	title: string;
	slug: string;
	description?: string;
	image?: string;
	type: string;
	isFeatured: boolean;
}

export function CollectionList({
	featured,
	limit,
}: {
	featured?: boolean;
	limit?: number;
}) {
	const api = useCollectionsApi();

	const { data, isLoading } = api.listCollections.useQuery({
		featured: featured ? "true" : undefined,
		limit: limit ? String(limit) : undefined,
	}) as {
		data:
			| {
					collections: Array<{
						id: string;
						name: string;
						slug: string;
						description?: string | null;
						image?: string | null;
						isFeatured: boolean;
					}>;
			  }
			| undefined;
		isLoading: boolean;
	};

	const collections: CollectionData[] = (data?.collections ?? []).map((c) => {
		const row: CollectionData = {
			id: c.id,
			title: c.name,
			slug: c.slug,
			type: "manual",
			isFeatured: c.isFeatured,
		};
		if (c.description != null) row.description = c.description;
		if (c.image != null) row.image = c.image;
		return row;
	});

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{[...Array(6)].map((_, i) => (
					<div
						key={i}
						className="overflow-hidden rounded-lg border border-border bg-card"
					>
						<div className="aspect-video animate-pulse bg-muted" />
						<div className="p-4">
							<div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
							<div className="mt-1 h-4 w-full animate-pulse rounded bg-muted" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (collections.length === 0) return null;

	return <CollectionListTemplate collections={collections} />;
}
