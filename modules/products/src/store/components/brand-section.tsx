"use client";

import Link from "next/link";
import { useBrandsApi } from "./_hooks";

/**
 * Displays the brand name with a link to the brand page on the product detail.
 * Returns null when the brands module is not installed or the product has no brand.
 */
export function BrandSection({ productId }: { productId: string }) {
	const api = useBrandsApi();

	const { data, isError } = api.getProductBrand.useQuery(
		{ params: { productId } },
		{ enabled: !!productId },
	) as {
		data:
			| { brand: { id: string; name: string; slug: string } | null }
			| undefined;
		isError: boolean;
	};

	if (isError || !data?.brand) return null;

	const { brand } = data;

	return (
		<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
			<span>Brand:</span>
			<Link
				href={`/brands/${brand.slug}`}
				className="font-medium text-foreground transition-colors hover:text-foreground/80 hover:underline"
			>
				{brand.name}
			</Link>
		</div>
	);
}
