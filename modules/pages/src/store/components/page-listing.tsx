"use client";

import { usePagesApi } from "./_hooks";
import PageListingTemplate from "./page-listing.mdx";

interface PageSummary {
	id: string;
	title: string;
	slug: string;
	excerpt?: string | null;
	featuredImage?: string | null;
}

export function PageListing({ limit = 50 }: { limit?: number | undefined }) {
	const api = usePagesApi();

	const { data, isLoading } = api.listPages.useQuery({
		limit: String(limit),
	}) as {
		data: { pages: PageSummary[]; total: number } | undefined;
		isLoading: boolean;
	};

	const pages = data?.pages ?? [];

	return <PageListingTemplate isLoading={isLoading} pages={pages} />;
}
