"use client";

import { escapeScriptContent } from "@86d-app/core/sanitize";
import { observer } from "mobx-react-lite";
import type { MetaTag } from "../../service";
import { useSeoApi } from "./_hooks";
import SeoHeadTemplate from "./seo-head.mdx";

export interface SeoHeadProps {
	/** Page path to fetch meta tags for */
	path: string;
	/** Fallback title if none configured */
	fallbackTitle?: string;
	/** Fallback description if none configured */
	fallbackDescription?: string;
}

/** Injects SEO meta tags, OpenGraph, Twitter Card, canonical URL, and JSON-LD into the page head. */
export const SeoHead = observer((props: SeoHeadProps) => {
	const api = useSeoApi();

	const { data } = api.getMeta.useQuery({
		queryKey: ["seo", "meta", props.path],
		params: { query: { path: props.path } },
	});

	const meta = data?.meta as MetaTag | null | undefined;

	const title = meta?.title ?? props.fallbackTitle;
	const description = meta?.description ?? props.fallbackDescription;

	return (
		<SeoHeadTemplate
			title={title ?? ""}
			description={description ?? ""}
			canonicalUrl={meta?.canonicalUrl ?? ""}
			ogTitle={meta?.ogTitle ?? title ?? ""}
			ogDescription={meta?.ogDescription ?? description ?? ""}
			ogImage={meta?.ogImage ?? ""}
			ogType={meta?.ogType ?? "website"}
			twitterCard={meta?.twitterCard ?? "summary"}
			twitterTitle={meta?.twitterTitle ?? title ?? ""}
			twitterDescription={meta?.twitterDescription ?? description ?? ""}
			twitterImage={meta?.twitterImage ?? meta?.ogImage ?? ""}
			noIndex={meta?.noIndex ?? false}
			noFollow={meta?.noFollow ?? false}
			jsonLd={
				meta?.jsonLd ? escapeScriptContent(JSON.stringify(meta.jsonLd)) : ""
			}
		/>
	);
});
