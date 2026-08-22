"use client";

import { useBrandsApi } from "./_hooks";
import BrandListTemplate from "./brand-list.mdx";

interface BrandData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	logo?: string;
	isFeatured: boolean;
}

export function BrandList({ limit }: { limit?: number }) {
	const api = useBrandsApi();

	const { data, isLoading } = api.listBrands.useQuery({
		take: limit ? String(limit) : undefined,
	}) as {
		data: { brands: BrandData[] } | undefined;
		isLoading: boolean;
	};

	const brands = data?.brands ?? [];

	if (isLoading) {
		return (
			<div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-muted" />
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
						<div
							key={key}
							className="flex flex-col items-center gap-3 rounded-xl border border-border p-6"
						>
							<div className="size-20 animate-pulse rounded-full bg-muted" />
							<div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
							<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (brands.length === 0) return null;

	return <BrandListTemplate brands={brands} />;
}
