import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import BlogPageClient from "./blog-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Blog — ${storeName}`,
		description: "Stories, updates, and insights from our team.",
	};
}

export default function BlogPage() {
	return <BlogPageClient />;
}
