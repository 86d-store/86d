"use client";

import BlogPostTemplate from "template/blog/[slug]/layout.mdx";

export default function BlogPostClient({ slug }: { slug: string }) {
	return <BlogPostTemplate slug={slug} />;
}
