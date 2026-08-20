import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBaseUrl } from "utils/url";
import { fetchBlogPostForSeo, getStoreName } from "~/lib/seo";
import BlogPostClient from "./blog-post-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const post = await fetchBlogPostForSeo(slug);
	if (!post) return { title: "Post not found" };

	const storeName = await getStoreName();
	const url = getBaseUrl();
	const title = `${post.title} — ${storeName}`;
	const description =
		post.excerpt?.slice(0, 160) ??
		`Read "${post.title}" on the ${storeName} blog.`;

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			url: `${url}/blog/${post.slug}`,
			type: "article",
			...(post.coverImage && {
				images: [{ url: post.coverImage, alt: post.title }],
			}),
			...(post.author && { authors: [post.author] }),
		},
		alternates: {
			canonical: `${url}/blog/${post.slug}`,
		},
	};
}

export default async function BlogPostPage({ params }: Props) {
	const { slug } = await params;
	const post = await fetchBlogPostForSeo(slug);

	if (!post) {
		notFound();
	}

	return <BlogPostClient slug={slug} />;
}
