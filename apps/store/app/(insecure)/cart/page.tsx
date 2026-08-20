import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import CartPageClient from "./cart-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Cart — ${storeName}`,
		description: `Review your shopping cart at ${storeName}.`,
	};
}

export default function CartPage() {
	return <CartPageClient />;
}
