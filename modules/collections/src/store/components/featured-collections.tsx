"use client";

import { useCollectionsApi } from "./_hooks";
import FeaturedCollectionsTemplate from "./featured-collections.mdx";

interface CollectionData {
	id: string;
	title: string;
	slug: string;
	description?: string;
	image?: string;
}

export function FeaturedCollections({ limit }: { limit?: number }) {
	const api = useCollectionsApi();

	const { data, isLoading } = api.getFeatured.useQuery({
		featured: "true",
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
					}>;
			  }
			| undefined;
		isLoading: boolean;
	};

	const collections: CollectionData[] = (data?.collections ?? []).map((c) => {
		const row: CollectionData = { id: c.id, title: c.name, slug: c.slug };
		if (c.description != null) row.description = c.description;
		if (c.image != null) row.image = c.image;
		return row;
	});

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-6 h-8 w-52 animate-pulse rounded-lg bg-muted" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{[...Array(8)].map((_, i) => (
						<div
							key={i}
							className="aspect-square animate-pulse rounded-xl bg-muted"
						/>
					))}
				</div>
			</section>
		);
	}

	if (collections.length === 0) return null;

	return <FeaturedCollectionsTemplate collections={collections} />;
}
