import type { Metadata } from "next";
import { getStoreName } from "~/lib/seo";
import {
	formatLegalPolicyRevisionDate,
	legalPolicyRevisionDates,
} from "../legal-policy-dates";
import TermsPageClient from "../terms-page-client";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: `Terms of Service — ${storeName}`,
		description: "Terms and conditions for using our store.",
	};
}

export default function TermsPage() {
	const lastUpdated = formatLegalPolicyRevisionDate(
		legalPolicyRevisionDates.terms,
	);

	return <TermsPageClient lastUpdated={lastUpdated} />;
}
