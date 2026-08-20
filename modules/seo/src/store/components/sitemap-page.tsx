"use client";

import { observer } from "@86d-app/core/state";
import { useSeoApi } from "./_hooks";
import { formatDate, pathToTitle } from "./_utils";
import SitemapPageTemplate from "./sitemap-page.mdx";

/** Human-readable sitemap page listing all indexable URLs. */
export const SitemapPage = observer(() => {
	const api = useSeoApi();

	const { data, isLoading, error } = api.getSitemap.useQuery({
		queryKey: ["seo", "sitemap"],
	});

	const entries = (
		(data?.entries as
			| Array<{ path: string; lastModified?: Date | string }>
			| undefined) ?? []
	).map((e) => ({
		path: e.path,
		label: pathToTitle(e.path),
		lastModified: e.lastModified ? formatDate(e.lastModified) : "",
	}));

	return (
		<SitemapPageTemplate
			entries={entries}
			loading={isLoading}
			error={error ? "Unable to load sitemap." : ""}
		/>
	);
});
