import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import GiftCardsPageClient from "./gift-cards-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Gift Cards — ${storeName}`,
		description: `Give the perfect gift. ${storeName} gift cards let recipients choose exactly what they want.`,
	};
}

export default function GiftCardsPage() {
	return <GiftCardsPageClient />;
}
