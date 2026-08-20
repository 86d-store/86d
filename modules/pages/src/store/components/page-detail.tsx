"use client";

import { usePagesApi } from "./_hooks";
import PageDetailTemplate from "./page-detail.mdx";

interface PageData {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | null;
	featuredImage?: string | null;
	publishedAt?: string | null;
	updatedAt: string;
}

export function PageDetail(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = usePagesApi();

	const { data, isLoading } = api.getPage.useQuery({
		params: { slug },
	}) as {
		data: { page: PageData | null } | undefined;
		isLoading: boolean;
	};

	// Content is sanitized where it is accepted, in the admin create and update
	// endpoints, so what is stored is what is safe to render. Sanitizing again
	// here would double-escape every character reference the author wrote.
	const page = data?.page ?? null;

	return <PageDetailTemplate isLoading={isLoading} page={page} />;
}
