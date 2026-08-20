import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import PrivacyPageClient from "../privacy-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Privacy Policy — ${storeName}`,
		description: "How we collect, use, and protect your personal information.",
	};
}

export default function PrivacyPage() {
	const lastUpdated = new Date().toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return <PrivacyPageClient lastUpdated={lastUpdated} />;
}
