import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import ContactPageClient from "./contact-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Contact — ${storeName}`,
		description: "Get in touch with us. We'd love to hear from you.",
	};
}

export default function ContactPage() {
	return <ContactPageClient />;
}
