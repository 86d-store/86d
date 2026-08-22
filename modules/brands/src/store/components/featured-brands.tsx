"use client";

import { useBrandsApi } from "./_hooks";
import FeaturedBrandsTemplate from "./featured-brands.mdx";

interface BrandData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	logo?: string;
}

export function FeaturedBrands({ limit }: { limit?: number }) {
	const api = useBrandsApi();

	const { data, isLoading } = api.getFeatured.useQuery({
		limit: limit ? String(limit) : undefined,
	}) as {
		data: { brands: BrandData[] } | undefined;
		isLoading: boolean;
	};

	const brands = data?.brands ?? [];

	if (isLoading) {
		return (
			<div className="py-8">
				<div className="mx-auto mb-6 h-8 w-40 animate-pulse rounded-lg bg-muted" />
				<div className="flex flex-wrap items-center justify-center gap-8">
					{Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
						<div key={key} className="flex items-center gap-3 px-4 py-3">
							<div className="size-12 animate-pulse rounded-full bg-muted" />
							<div className="h-5 w-20 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (brands.length === 0) return null;

	return <FeaturedBrandsTemplate brands={brands} />;
}
