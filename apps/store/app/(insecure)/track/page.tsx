import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import TrackPageClient from "./track-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Track Order — ${storeName}`,
		description: `Track your order status at ${storeName}. Enter your order number and email to check the delivery status.`,
	};
}

export default function TrackPage() {
	return <TrackPageClient />;
}
