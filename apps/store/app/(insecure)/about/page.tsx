import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import AboutPageClient from "../about-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `About — ${storeName}`,
		description:
			"Learn about our story, mission, and commitment to quality products.",
	};
}

export default function AboutPage() {
	return <AboutPageClient />;
}
