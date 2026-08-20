import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import TermsPageClient from "../terms-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Terms of Service — ${storeName}`,
		description: "Terms and conditions for using our store.",
	};
}

export default function TermsPage() {
	const lastUpdated = new Date().toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return <TermsPageClient lastUpdated={lastUpdated} />;
}
