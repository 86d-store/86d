"use client";

import Link from "next/link";
import { useBlogApi } from "./_hooks";
import { formatDate } from "./_utils";
import BlogPostDetailTemplate from "./blog-post-detail.mdx";

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

export function BlogPostDetail(props: {
	slug?: string;
	params?: Record<string, string>;
}) {
	const slug = props.slug ?? props.params?.slug;
	const api = useBlogApi();

	const { data, isLoading } = api.getPost.useQuery(
		{ params: { slug: slug ?? "" } },
		{ enabled: !!slug },
	) as {
		data: { post: BlogPost | null } | undefined;
		isLoading: boolean;
	};

	const post = data?.post;

	if (!slug) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Post not found</p>
				<p className="mt-1 text-sm">No post was specified.</p>
				<Link href="/blog" className="mt-3 inline-block text-sm underline">
					Back to blog
				</Link>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-4">
				<div className="h-8 w-2/3 rounded bg-muted" />
				<div className="h-4 w-48 rounded bg-muted" />
				<div className="space-y-2">
					<div className="h-4 w-full rounded bg-muted" />
					<div className="h-4 w-full rounded bg-muted" />
					<div className="h-4 w-3/4 rounded bg-muted" />
				</div>
			</div>
		);
	}

	if (!post) {
		return (
			<div className="py-16 text-center">
				<h2 className="font-semibold text-foreground text-xl">
					Post not found
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					This post may have been removed or is no longer available.
				</p>
				<Link
					href="/blog"
					className="mt-4 inline-block text-primary text-sm hover:underline"
				>
					&larr; Back to blog
				</Link>
			</div>
		);
	}

	return <BlogPostDetailTemplate post={post} formatDate={formatDate} />;
}
