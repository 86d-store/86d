import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import GiftCardsPageClient from "./gift-cards-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Gift card balance — ${storeName}`,
		description: `Check the recorded balance and status of a ${storeName} gift card. Gift card redemption is unavailable.`,
	};
}

export default function GiftCardsPage() {
	return <GiftCardsPageClient />;
}
