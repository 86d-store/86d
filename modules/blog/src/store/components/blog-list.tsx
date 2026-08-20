"use client";

import { useBlogApi } from "./_hooks";
import { formatDate } from "./_utils";
import BlogListTemplate from "./blog-list.mdx";

interface BlogPost {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | null;
	coverImage?: string | null;
	author?: string | null;
	status: string;
	tags: string[];
	category?: string | null;
	publishedAt?: string | null;
	createdAt: string;
}

export function BlogList({
	limit = 20,
	category,
	tag,
}: {
	limit?: number | undefined;
	category?: string | undefined;
	tag?: string | undefined;
}) {
	const api = useBlogApi();

	const queryInput: Record<string, unknown> = { limit: String(limit) };
	if (category) queryInput.category = category;
	if (tag) queryInput.tag = tag;

	const { data, isLoading, isError, refetch } = api.listPosts.useQuery(
		queryInput,
	) as {
		data: { posts: BlogPost[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const posts = data?.posts ?? [];

	return (
		<BlogListTemplate
			isLoading={isLoading}
			isError={isError}
			onRetry={refetch}
			posts={posts}
			formatDate={formatDate}
		/>
	);
}
