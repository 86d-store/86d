import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import SearchPageClient from "./search-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Search — ${storeName}`,
		description: `Search products at ${storeName}. Find exactly what you're looking for.`,
	};
}

export default function SearchPage() {
	return <SearchPageClient />;
}
